import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pulse.decisionos',
  appName: 'PULSE',
  webDir: 'dist',
  server: {
    // Points the native shell at your deployed web app instead of bundling a
    // stale local copy — the native app always shows what's live on Render.
    // Swap this to your real production URL before shipping to app stores.
    url: 'https://your-pulse-app.onrender.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
