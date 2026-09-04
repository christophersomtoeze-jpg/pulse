export interface MentionableUser {
  id: string;
  name: string;
}

/** Matches "@Full Name" or "@word" tokens as the user types. */
const MENTION_TOKEN = /@([a-zA-Z][a-zA-Z0-9 ._-]{0,40})/g;

/** Given comment text and the workspace's members, returns the user ids actually @mentioned. */
export function extractMentionedUserIds(body: string, members: MentionableUser[]): string[] {
  const matches = [...body.matchAll(MENTION_TOKEN)].map((m) => m[1].trim().toLowerCase());
  if (matches.length === 0) return [];
  const ids = new Set<string>();
  for (const member of members) {
    const name = member.name.trim().toLowerCase();
    if (matches.some((m) => name === m || name.startsWith(m))) ids.add(member.id);
  }
  return [...ids];
}

/** Splits comment text into plain/mention segments for rendering with highlighted @mentions. */
export function splitMentionSegments(body: string): { text: string; isMention: boolean }[] {
  const segments: { text: string; isMention: boolean }[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: body.slice(lastIndex, index), isMention: false });
    segments.push({ text: match[0], isMention: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) segments.push({ text: body.slice(lastIndex), isMention: false });
  return segments;
}

/** Suggestions for the mention autocomplete dropdown given the text typed after the last "@". */
export function suggestMentions(query: string, members: MentionableUser[], limit = 5): MentionableUser[] {
  const q = query.trim().toLowerCase();
  return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, limit);
}
