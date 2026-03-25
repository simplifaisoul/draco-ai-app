/**
 * Agent Session API — Create, List, Delete agent sessions
 * Each session = 1 LXC container on Proxmox
 * 
 * ARCHITECTURE: Uses in-memory sessionMeta as primary source of truth for
 * which user owns which container. Validates container state via individual
 * Proxmox status checks (not the list endpoint, which may lack permissions).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createContainer, getNextVmid, destroyContainer,
  waitForContainer, getContainerStatus,
  startContainer, stopContainer, rebootContainer, getContainerIP
} from '@/app/lib/proxmox';
import { setupContainer } from '@/app/lib/ssh';

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
    const { userId, userPlan } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

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

    // Generate session ID and get next VMID
    const sessionId = crypto.randomUUID();
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
        
        // Lightweight setup (no apt — clean boot)
        try {
          await setupContainer(vmid);
          console.log(`[SESSION] CT ${vmid} setup complete`);
        } catch (err) {
          console.error(`[SESSION] Setup warning:`, err);
        }
      } catch (err: any) {
        console.error(`[SESSION] CT creation failed:`, err.message);
        // Remove from sessionMeta if creation failed
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
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // 1. Rehydrate sessionMeta from Proxmox truth (fixes disappearances on serverless cold starts)
  try {
    const proxmoxContainers = await require('@/app/lib/proxmox').listContainersForUser(userId);
    for (const c of proxmoxContainers) {
      const vmid = c.vmid;
      let found = false;
      for (const [sid, meta] of sessionMeta.entries()) {
        if (meta.vmid === vmid) found = true;
      }
      if (!found) {
        // Reconstruct sessionId from the LXC description if possible (format: draco-agent|userId|sessionId)
        let sessionId = crypto.randomUUID();
        if (c.description && c.description.includes('|')) {
          const parts = c.description.split('|');
          if (parts.length >= 3) sessionId = parts[2];
        }
        sessionMeta.set(sessionId, { vmid, userId, createdAt: Date.now() });
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
      // Container might not exist yet (still creating) or was destroyed externally
      if (err.message?.includes('500') || err.message?.includes('not found') || err.message?.includes('does not exist')) {
        // Container is gone — remove from sessionMeta
        console.log(`[SESSION] CT ${entry.vmid} no longer exists, cleaning up sessionMeta`);
        sessionMeta.delete(entry.sessionId);
        return null; // Will be filtered out
      }
      // Otherwise it might be creating
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

  // Filter out null entries (deleted containers)
  return NextResponse.json({ sessions: sessions.filter(Boolean) });
}

export async function DELETE(request: NextRequest) {
  try {
    const { sessionId, userId, vmid: directVmid } = await request.json();

    let vmid = directVmid;
    
    if (sessionId && sessionMeta.has(sessionId)) {
      const meta = sessionMeta.get(sessionId)!;
      // SECURITY: verify the userId matches
      if (userId && meta.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
    let { vmid, action, userId } = await request.json();

    if (!vmid || !action) {
      return NextResponse.json({ error: 'vmid and action required' }, { status: 400 });
    }

    // Parse vmid to integer
    if (typeof vmid === 'string') {
      const parsed = parseInt(vmid.replace(/\D/g, ''));
      if (!isNaN(parsed)) vmid = parsed;
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
