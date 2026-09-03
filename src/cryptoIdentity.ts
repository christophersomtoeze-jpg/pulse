export interface Identity {
  userId: string;
  shortId: string;
  publicKeyJWK: JsonWebKey;
  privateKeyJWK: JsonWebKey;
}

const STORAGE_KEY = 'pulse:identity:v1';

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
}

export async function getOrCreateIdentity(): Promise<Identity> {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing) as Identity;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const publicKeyJWK = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJWK = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const enc = new TextEncoder();
  const pubBuffer = enc.encode(JSON.stringify(publicKeyJWK));
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', pubBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const userId = `usr_${hashHex.slice(0, 32)}`;
  const rawShort = hashHex.slice(0, 8).toUpperCase();
  const shortId = `${rawShort.slice(0, 4)}-${rawShort.slice(4, 8)}`;

  const identity: Identity = {
    userId,
    shortId,
    publicKeyJWK,
    privateKeyJWK,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export async function signPayload(payload: string, privateKeyJWK: JsonWebKey): Promise<string> {
  const privateKey = await importPrivateKey(privateKeyJWK);
  const enc = new TextEncoder();
  const signature = await window.crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    enc.encode(payload)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifyPayload(
  payload: string,
  signatureBase64: string,
  publicKeyJWK: JsonWebKey
): Promise<boolean> {
  const publicKey = await importPublicKey(publicKeyJWK);
  const enc = new TextEncoder();
  const sigBuf = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));
  return window.crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    publicKey,
    sigBuf,
    enc.encode(payload)
  );
}

export function clearIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}