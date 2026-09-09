// Supabase Edge Function: webhook-intake
// --------------------------------------
// Public incoming webhook endpoint.
//
// Deploy with:
// supabase functions deploy webhook-intake --no-verify-jwt
//
// URL:
// https://<project-ref>.supabase.co/functions/v1/webhook-intake/<token>
//
// POST body:
// {
//   "title": "Example update",
//   "body": "This is the webhook message."
// }

import { createClient } from "supabase";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(
  data: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

Deno.serve(async (req: Request) => {
  // --------------------------------------------------
  // CORS preflight
  // --------------------------------------------------
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // --------------------------------------------------
  // Only POST requests are allowed
  // --------------------------------------------------
  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed",
        message: "This webhook endpoint only accepts POST requests.",
      },
      405,
    );
  }

  // --------------------------------------------------
  // Check required Supabase environment variables
  // --------------------------------------------------
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );

    return jsonResponse(
      {
        error: "Server configuration error",
      },
      500,
    );
  }

  // --------------------------------------------------
  // Get webhook token from URL
  // --------------------------------------------------
  const url = new URL(req.url);

  const pathParts = url.pathname
    .split("/")
    .filter(Boolean);

  const token = pathParts[pathParts.length - 1];

  if (!token || token === "webhook-intake") {
    return jsonResponse(
      {
        error: "Missing webhook token in URL",
      },
      400,
    );
  }

  // --------------------------------------------------
  // Create Supabase admin client
  // --------------------------------------------------
  const admin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  // --------------------------------------------------
  // Find the incoming webhook
  // --------------------------------------------------
  const {
    data: hook,
    error: hookError,
  } = await admin
    .from("incoming_webhooks")
    .select("id, workspace_id, name")
    .eq("token", token)
    .maybeSingle();

  if (hookError) {
    console.error("Webhook lookup failed:", hookError);

    return jsonResponse(
      {
        error: "Unable to validate webhook",
      },
      500,
    );
  }

  if (!hook) {
    return jsonResponse(
      {
        error: "Unknown or revoked webhook token",
      },
      404,
    );
  }

  // --------------------------------------------------
  // Read request body
  // --------------------------------------------------
  let payload: Record<string, unknown> = {};

  try {
    const contentType =
      req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const parsed = await req.json();

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        payload = parsed as Record<string, unknown>;
      }
    } else {
      const rawBody = await req.text();

      if (rawBody.trim()) {
        try {
          const parsed = JSON.parse(rawBody);

          if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
          ) {
            payload = parsed as Record<string, unknown>;
          }
        } catch {
          payload = {
            body: rawBody,
          };
        }
      }
    }
  } catch (error) {
    console.error("Unable to read webhook body:", error);

    return jsonResponse(
      {
        error: "Invalid request body",
      },
      400,
    );
  }

  // --------------------------------------------------
  // Prepare title and body
  // --------------------------------------------------
  const title =
    cleanText(payload.title, 200) ||
    `Update from ${hook.name}`;

  let body = cleanText(payload.body, 10000);

  // If no body was supplied, store the received payload.
  if (!body) {
    try {
      body = JSON.stringify(payload, null, 2).slice(0, 10000);
    } catch {
      body = "Webhook received without a message body.";
    }
  }

  // --------------------------------------------------
  // Find workspace owner
  // --------------------------------------------------
  const {
    data: workspace,
    error: workspaceError,
  } = await admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", hook.workspace_id)
    .maybeSingle();

  if (workspaceError) {
    console.error(
      "Workspace lookup failed:",
      workspaceError,
    );

    return jsonResponse(
      {
        error: "Unable to find webhook workspace",
      },
      500,
    );
  }

  if (!workspace?.owner_id) {
    return jsonResponse(
      {
        error: "Workspace owner could not be found",
      },
      500,
    );
  }

  const ownerId = workspace.owner_id;

  // --------------------------------------------------
  // Find or create the webhook discussion
  // --------------------------------------------------
  const discussionTitle = `${hook.name} (webhook)`;

  let {
    data: discussion,
    error: discussionLookupError,
  } = await admin
    .from("discussions")
    .select("id")
    .eq("workspace_id", hook.workspace_id)
    .eq("title", discussionTitle)
    .maybeSingle();

  if (discussionLookupError) {
    console.error(
      "Discussion lookup failed:",
      discussionLookupError,
    );

    return jsonResponse(
      {
        error: "Unable to find webhook discussion",
      },
      500,
    );
  }

  // --------------------------------------------------
  // Create discussion if it does not exist
  // --------------------------------------------------
  if (!discussion) {
    const {
      data: createdDiscussion,
      error: createDiscussionError,
    } = await admin
      .from("discussions")
      .insert({
        workspace_id: hook.workspace_id,
        title: discussionTitle,
        summary: `Incoming updates from ${hook.name}`,
        status: "active",
        created_by: ownerId,
      })
      .select("id")
      .single();

    if (createDiscussionError) {
      console.error(
        "Discussion creation failed:",
        createDiscussionError,
      );

      return jsonResponse(
        {
          error: "Unable to create webhook discussion",
        },
        500,
      );
    }

    discussion = createdDiscussion;
  }

  // --------------------------------------------------
  // Add webhook message to discussion
  // --------------------------------------------------
  const messageBody = `**${title}**\n\n${body}`;

  const {
    error: messageError,
  } = await admin
    .from("messages")
    .insert({
      discussion_id: discussion.id,
      author_id: ownerId,
      body: messageBody,
    });

  if (messageError) {
    console.error(
      "Message creation failed:",
      messageError,
    );

    return jsonResponse(
      {
        error: "Unable to save webhook message",
      },
      500,
    );
  }

  // --------------------------------------------------
  // Update webhook last-used timestamp
  // --------------------------------------------------
  const {
    error: updateWebhookError,
  } = await admin
    .from("incoming_webhooks")
    .update({
      last_used_at: new Date().toISOString(),
    })
    .eq("id", hook.id);

  if (updateWebhookError) {
    // The message was already saved, so don't report the
    // entire webhook as failed. Log the timestamp problem.
    console.error(
      "Unable to update webhook last_used_at:",
      updateWebhookError,
    );
  }

  // --------------------------------------------------
  // Success
  // --------------------------------------------------
  return jsonResponse({
    received: true,
    webhook: hook.name,
    discussion_id: discussion.id,
    message_saved: true,
  });
});