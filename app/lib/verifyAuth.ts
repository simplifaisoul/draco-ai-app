/**
 * Auth Verification Middleware for API Routes
 * 
 * Extracts Bearer token from Authorization header,
 * verifies it via Firebase, and returns decoded user info.
 * Also provides container ownership validation.
 */

import { NextRequest } from 'next/server';
import { verifyFirebaseToken, DecodedToken } from './firebaseAdmin';
import { listContainers, parseContainerOwnerFromTags } from './proxmox';

export interface AuthResult {
  success: true;
  user: DecodedToken;
}

export interface AuthError {
  success: false;
  error: string;
  status: number;
}

/**
 * Verify the Firebase ID token from the request.
 * Accepts token from:
 *   1. Authorization: Bearer <token> header
 *   2. JSON body field `idToken`
 */
export async function verifyAuth(
  request: NextRequest,
  body?: any
): Promise<AuthResult | AuthError> {
  try {
    // Try Authorization header first
    let token = '';
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    // Fallback: check body for idToken
    if (!token && body?.idToken) {
      token = body.idToken;
    }

    if (!token) {
      return {
        success: false,
        error: 'Authentication required. No token provided.',
        status: 401,
      };
    }

    const user = await verifyFirebaseToken(token);
    return { success: true, user };
  } catch (err: any) {
    console.error('[AUTH] Token verification failed:', err.message);
    return {
      success: false,
      error: `Authentication failed: ${err.message}`,
      status: 401,
    };
  }
}

/**
 * Verify that a user owns a specific container (by VMID).
 * Checks the container's Proxmox tags for uid-{sanitizedUserId}.
 */
export async function verifyContainerOwnership(
  uid: string,
  vmid: number
): Promise<boolean> {
  try {
    const containers = await listContainers();
    const container = containers.find((c: any) => {
      const cVmid = typeof c.vmid === 'string' ? parseInt(c.vmid) : c.vmid;
      return cVmid === vmid;
    });

    if (!container) {
      // Container doesn't exist — deny
      return false;
    }

    // Check tags
    const ownerTag = parseContainerOwnerFromTags(container.tags || '');
    const sanitizedUid = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    
    if (ownerTag === sanitizedUid) {
      return true;
    }

    // Fallback: check description (format: "draco-agent|{userId}|{sessionId}")
    if (container.description?.includes('|')) {
      const parts = container.description.split('|');
      if (parts.length >= 2 && parts[1] === uid) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('[AUTH] Ownership check failed:', err);
    return false;
  }
}

/**
 * Create a JSON error Response for auth failures
 */
export function authErrorResponse(authResult: AuthError): Response {
  return new Response(
    JSON.stringify({ error: authResult.error }),
    {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
