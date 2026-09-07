// Generates a real VAPID key pair for Web Push, using nothing but Node's
// built-in crypto module. Run once locally:
//
//   node scripts/generate-vapid-keys.js
//
// Then:
//   - Put VITE_VAPID_PUBLIC_KEY in Render's environment variables (it's public, safe in the frontend)
//   - Run: supabase secrets set VAPID_PRIVATE_KEY=<the private key printed below>
//   - Run: supabase secrets set VAPID_SUBJECT=mailto:you@yourcompany.com
//
// Never commit the private key to git.

import crypto from 'node:crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwkPub = publicKey.export({ format: 'jwk' });
const jwkPriv = privateKey.export({ format: 'jwk' });

const rawPublicKey = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(jwkPub.x, 'base64url'),
  Buffer.from(jwkPub.y, 'base64url'),
]);

console.log('\nVAPID keys generated. Add these:\n');
console.log(`VITE_VAPID_PUBLIC_KEY=${rawPublicKey.toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${jwkPriv.d}\n`);
