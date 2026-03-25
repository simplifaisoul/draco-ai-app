/**
 * Firebase ID Token Verifier (No firebase-admin SDK needed)
 * 
 * Validates Firebase Auth ID tokens by:
 * 1. Decoding the JWT header to get the key ID (kid)
 * 2. Fetching Google's public keys (JWKS) for RS256 verification
 * 3. Verifying signature, expiry, audience, and issuer
 * 
 * This avoids the heavy firebase-admin dependency while providing
 * the same security guarantees.
 */

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Cache public keys with TTL
let cachedKeys: Record<string, string> = {};
let cacheExpiry = 0;

async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedKeys && cacheExpiry > now && Object.keys(cachedKeys).length > 0) {
    return cachedKeys;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public keys: ${res.status}`);
  }

  // Parse cache-control for TTL
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) * 1000 : 3600_000; // Default 1hr

  cachedKeys = await res.json();
  cacheExpiry = now + maxAge;
  return cachedKeys;
}

/**
 * Base64url decode (handles missing padding)
 */
function base64urlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4 !== 0) str += '=';
  return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * Import an X.509 PEM certificate as a CryptoKey for RS256 verification.
 * Works in Node.js using the native crypto module.
 */
async function importPublicKey(pem: string): Promise<any> {
  const crypto = await import('crypto');
  return crypto.createPublicKey(pem);
}

/**
 * Verify RS256 signature using Node.js crypto
 */
async function verifyRS256(token: string, publicKeyPem: string): Promise<boolean> {
  const crypto = await import('crypto');
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  
  const signedData = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(
    signatureB64.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  );

  const publicKey = crypto.createPublicKey(publicKeyPem);
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signedData);
  return verifier.verify(publicKey, signature);
}

export interface DecodedToken {
  uid: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
}

/**
 * Verify a Firebase ID token and return the decoded claims.
 * Throws on invalid/expired tokens.
 */
export async function verifyFirebaseToken(idToken: string): Promise<DecodedToken> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing or invalid ID token');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT: expected 3 parts');
  }

  // Decode header
  let header: { alg: string; kid: string };
  try {
    header = JSON.parse(base64urlDecode(parts[0]));
  } catch {
    throw new Error('Malformed JWT header');
  }

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  if (!header.kid) {
    throw new Error('Missing key ID in JWT header');
  }

  // Decode payload
  let payload: any;
  try {
    payload = JSON.parse(base64urlDecode(parts[1]));
  } catch {
    throw new Error('Malformed JWT payload');
  }

  // Time checks
  const now = Math.floor(Date.now() / 1000);
  
  if (!payload.exp || payload.exp < now) {
    throw new Error('Token expired');
  }

  if (!payload.iat || payload.iat > now + 300) {
    // Allow 5 min clock skew
    throw new Error('Token issued in the future');
  }

  // Audience check
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error(`Invalid audience: ${payload.aud}`);
  }

  // Issuer check
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error(`Invalid issuer: ${payload.iss}`);
  }

  // Subject check (uid)
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Missing subject (uid)');
  }

  // Signature verification
  const publicKeys = await getGooglePublicKeys();
  const publicKeyPem = publicKeys[header.kid];
  
  if (!publicKeyPem) {
    throw new Error(`Unknown key ID: ${header.kid}`);
  }

  const valid = await verifyRS256(idToken, publicKeyPem);
  if (!valid) {
    throw new Error('Invalid token signature');
  }

  return {
    uid: payload.sub,
    email: payload.email,
    name: payload.name,
    email_verified: payload.email_verified,
  };
}
