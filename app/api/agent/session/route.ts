/**
 * Agent Session API — Create, List, Delete agent sessions
 * Each session = 1 LXC container on Proxmox
 * 
 * SECURITY: All endpoints require valid Firebase ID token.
 * 
 * ARCHITECTURE: Uses in-memory sessionMeta as primary source of truth for
 * which user owns which container. Validates container state via individual
 * Proxmox status checks (not the list endpoint, which may lack permissions).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createContainer, getNextVmid, destroyContainer,
  waitForContainer, getContainerStatus,
  startContainer, stopContainer, rebootContainer, getContainerIP,
  claimIdleContainer
} from '@/app/lib/proxmox';
import { setupContainer } from '@/app/lib/ssh';
import { verifyAuth, authErrorResponse } from '@/app/lib/verifyAuth';

// In-memory session metadata — primary source for user→container mapping
const sessionMeta = new Map<string, {
  vmid: number;
  userId: string;
  createdAt: number;
}>();

// SSH public key for container access
const SSH_PUB_KEY = process.env.PROXMOX_SSH_PUB_KEY || '';

// Max containers PER USER
const MAX_CONTAINERS_PER_USER = 3;

// Helper: get all VMIDs owned by a user from sessionMeta
function getUserVmids(userId: string): { sessionId: string; vmid: number; createdAt: number }[] {
  const results: { sessionId: string; vmid: number; createdAt: number }[] = [];
  for (const [sessionId, meta] of sessionMeta.entries()) {
    if (meta.userId === userId) {
      results.push({ sessionId, vmid: meta.vmid, createdAt: meta.createdAt });
    }
  }
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userPlan } = body;

    // SECURITY: Verify Firebase ID token
    const auth = await verifyAuth(request, body);
    if (!auth.success) {
      return authErrorResponse(auth);
    }
    const userId = auth.user.uid;

    // Gate: Pro/Team/Dragon only
    if (!userPlan || userPlan === 'free') {
      return NextResponse.json(
        { error: 'Agent sessions require a Pro or Dragon plan.' },
        { status: 403 }
      );
    }

    // Check THIS USER's containers from sessionMeta
    const userContainers = getUserVmids(userId);

    if (userContainers.length >= MAX_CONTAINERS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CONTAINERS_PER_USER} containers per account. You have ${userContainers.length}. Destroy one first.` },
        { status: 429 }
      );
    }

    const sessionId = crypto.randomUUID();

    // ── WARM POOL: Try to claim a pre-booted idle container first ──
    try {
      const claimed = await claimIdleContainer(userId, sessionId);
      if (claimed) {
        // INSTANT handoff — container is already running + pre-tooled
        sessionMeta.set(sessionId, {
          vmid: claimed.vmid,
          userId,
          createdAt: Date.now(),
        });

        console.log(`[SESSION] ⚡ INSTANT handoff: CT ${claimed.vmid} → user ${userId.slice(0, 8)}... (from warm pool)`);

        return NextResponse.json({
          sessionId,
          vmid: claimed.vmid,
          status: 'running', // Already running! No waiting!
          containerIP: claimed.containerIP,
        });
      }
    } catch (err) {
      console.warn('[SESSION] Warm pool claim failed, falling back to fresh creation:', err);
    }

    // ── FALLBACK: No idle containers available, create fresh ──
    console.log('[SESSION] No warm pool containers available, creating fresh...');
    const vmid = await getNextVmid();

    // Record session metadata IMMEDIATELY (before async creation)
    sessionMeta.set(sessionId, {
      vmid,
      userId,
      createdAt: Date.now(),
    });

    console.log(`[SESSION] Registered CT ${vmid} → user ${userId.slice(0, 8)}... (session ${sessionId.slice(0, 8)})`);

    const responseData: any = {
      sessionId,
      vmid,
      status: 'creating',
    };

    // Create container in background
    (async () => {
      try {
        console.log(`[SESSION] Creating CT ${vmid}...`);
        await createContainer(vmid, sessionId, SSH_PUB_KEY, userId);
        
        const ip = await waitForContainer(vmid, 60000);
        console.log(`[SESSION] CT ${vmid} ready at ${ip}`);
        
        // Lightweight setup
        try {
          await setupContainer(vmid);
          console.log(`[SESSION] CT ${vmid} setup complete`);
        } catch (err) {
          console.error(`[SESSION] Setup warning:`, err);
        }
      } catch (err: any) {
        console.error(`[SESSION] CT creation failed:`, err.message);
        sessionMeta.delete(sessionId);
      }
    })();

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create agent session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Verify Firebase ID token from query params
  const { searchParams } = new URL(request.url);
  const idToken = searchParams.get('idToken');
  
  if (!idToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let userId: string;
  try {
    const { verifyFirebaseToken } = require('@/app/lib/firebaseAdmin');
    const decoded = await verifyFirebaseToken(idToken);
    userId = decoded.uid;
  } catch (err: any) {
    return NextResponse.json({ error: `Authentication failed: ${err.message}` }, { status: 401 });
  }

  // 1. Rehydrate sessionMeta from Proxmox truth (fixes disappearances on serverless cold starts)
  try {
    const allContainers = await require('@/app/lib/proxmox').listContainers();
    for (const c of allContainers) {
      const vmid = typeof c.vmid === 'string' ? parseInt(c.vmid) : c.vmid;
      
      // Parse description to extract owner: format is "draco-agent|{userId}|{sessionId}"
      let ownerUserId: string | null = null;
      let storedSessionId: string | null = null;
      if (c.description && c.description.includes('|')) {
        const parts = c.description.split('|');
        if (parts.length >= 3 && parts[0] === 'draco-agent') {
          ownerUserId = parts[1];
          storedSessionId = parts[2];
        }
      }

      // Only rehydrate containers belonging to THIS user
      if (ownerUserId !== userId) continue;

      // Check if already tracked in sessionMeta
      let found = false;
      for (const [, meta] of sessionMeta.entries()) {
        if (meta.vmid === vmid) { found = true; break; }
      }
      if (!found) {
        const sessionId = storedSessionId || crypto.randomUUID();
        sessionMeta.set(sessionId, { vmid, userId, createdAt: Date.now() });
        console.log(`[SESSION] Rehydrated CT ${vmid} for user ${userId.slice(0, 8)}... (session ${sessionId.slice(0, 8)})`);
      }
    }
  } catch (err) {
    console.error('[SESSION] Failed to rehydrate sessions from Proxmox:', err);
  }

  // 2. Get this user's containers from sessionMeta
  const userContainers = getUserVmids(userId);

  // For each container, check live status from Proxmox
  const sessions = await Promise.all(userContainers.map(async (entry) => {
    let status = 'creating';
    let containerIP: string | null = null;

    try {
      const s = await getContainerStatus(entry.vmid);
      status = s.status; // 'running', 'stopped', etc.
      
      if (status === 'running') {
        try {
          containerIP = await getContainerIP(entry.vmid);
        } catch {}
      }
    } catch (err: any) {
      if (err.message?.includes('500') || err.message?.includes('not found') || err.message?.includes('does not exist')) {
        console.log(`[SESSION] CT ${entry.vmid} no longer exists, cleaning up sessionMeta`);
        sessionMeta.delete(entry.sessionId);
        return null;
      }
      status = 'creating';
    }

    return {
      sessionId: entry.sessionId,
      vmid: entry.vmid,
      status,
      containerIP,
      createdAt: entry.createdAt,
    };
  }));

  return NextResponse.json({ sessions: sessions.filter(Boolean) });
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, vmid: directVmid } = body;

    // SECURITY: Verify Firebase ID token
    const auth = await verifyAuth(request, body);
    if (!auth.success) {
      return authErrorResponse(auth);
    }
    const userId = auth.user.uid;

    let vmid = directVmid;
    
    if (sessionId && sessionMeta.has(sessionId)) {
      const meta = sessionMeta.get(sessionId)!;
      // SECURITY: verify the authenticated user owns this session
      if (meta.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized — you do not own this container' }, { status: 403 });
      }
      vmid = meta.vmid;
    }

    if (!vmid) {
      return NextResponse.json({ error: 'No container found for this session' }, { status: 404 });
    }

    // Parse vmid to integer
    if (typeof vmid === 'string') {
      const parsed = parseInt(vmid.replace(/\D/g, ''));
      if (!isNaN(parsed)) vmid = parsed;
    }

    console.log(`[SESSION] Destroying CT ${vmid}`);
    await destroyContainer(vmid);
    console.log(`[SESSION] CT ${vmid} destroyed successfully`);

    // Clean up ALL sessionMeta entries for this vmid
    for (const [sid, meta] of sessionMeta.entries()) {
      if (meta.vmid === vmid) {
        sessionMeta.delete(sid);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[SESSION] Destroy error:`, error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to delete session' },
      { status: 500 }
    );
  }
}

// PATCH — Container actions: start, stop, reboot
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    let { vmid, action } = body;

    if (!vmid || !action) {
      return NextResponse.json({ error: 'vmid and action required' }, { status: 400 });
    }

    // SECURITY: Verify Firebase ID token
    const auth = await verifyAuth(request, body);
    if (!auth.success) {
      return authErrorResponse(auth);
    }

    // Parse vmid to integer
    if (typeof vmid === 'string') {
      const parsed = parseInt(vmid.replace(/\D/g, ''));
      if (!isNaN(parsed)) vmid = parsed;
    }

    // SECURITY: Verify container ownership
    const { verifyContainerOwnership } = require('@/app/lib/verifyAuth');
    const owns = await verifyContainerOwnership(auth.user.uid, vmid);
    if (!owns) {
      return NextResponse.json({ error: 'You do not have access to this container' }, { status: 403 });
    }

    console.log(`[SESSION] Action '${action}' on CT ${vmid}`);

    switch (action) {
      case 'start':
        await startContainer(vmid);
        break;
      case 'stop':
        await stopContainer(vmid);
        break;
      case 'reboot':
        await rebootContainer(vmid);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Wait a moment then get updated status
    await new Promise(r => setTimeout(r, 2000));
    
    let status = 'unknown';
    let containerIP: string | null = null;
    try {
      const s = await getContainerStatus(vmid);
      status = s.status;
      if (status === 'running') {
        containerIP = await getContainerIP(vmid);
      }
    } catch {}

    return NextResponse.json({ success: true, vmid, status, containerIP });
  } catch (error: any) {
    console.error(`[SESSION] Action error:`, error.message);
    return NextResponse.json(
      { error: error.message || 'Action failed' },
      { status: 500 }
    );
  }
}
