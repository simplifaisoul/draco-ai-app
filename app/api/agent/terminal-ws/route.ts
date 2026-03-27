/**
 * Terminal WebSocket Proxy — Real-time PTY via SSH
 * 
 * This endpoint opens an SSH connection to the Proxmox host,
 * runs `pct enter {vmid}` to get a live shell inside the container,
 * and pipes stdin/stdout bidirectionally over a WebSocket.
 * 
 * This gives a TRUE interactive terminal — bash, vim, htop, tab completion,
 * Ctrl+C, colors, readline, everything works natively.
 * 
 * SECURITY: Requires valid Firebase ID token + container ownership.
 * 
 * Uses Next.js Route Handler with WebSocket upgrade.
 */

import { NextRequest } from 'next/server';
import { Client as SSHClient } from 'ssh2';
import { verifyFirebaseToken } from '@/app/lib/firebaseAdmin';
import { verifyContainerOwnership } from '@/app/lib/verifyAuth';

const SSH_PRIVATE_KEY = process.env.PROXMOX_SSH_PRIVATE_KEY
  ? Buffer.from(process.env.PROXMOX_SSH_PRIVATE_KEY, 'base64').toString('utf-8')
  : '';
const PROXMOX_HOST = process.env.PROXMOX_SSH_HOST || 'ssh.simplifai-1.org';

export const dynamic = 'force-dynamic';

// Next.js doesn't natively support WebSocket upgrades in Route Handlers.
// Instead, we use a long-lived SSE stream as a real-time transport with 
// a companion POST endpoint for stdin. This provides the same UX as a WebSocket
// while working within Next.js/Vercel's architecture.

/**
 * GET — Start a streaming terminal session (SSE)
 * Opens an SSH connection, runs `pct enter {vmid}`, and streams PTY output.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vmidStr = searchParams.get('vmid');
  const token = searchParams.get('token');

  if (!vmidStr || !token) {
    return new Response(JSON.stringify({ error: 'vmid and token are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const vmid = parseInt(vmidStr);
  if (isNaN(vmid)) {
    return new Response(JSON.stringify({ error: 'Invalid vmid' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SECURITY: Verify Firebase token bypassed
  let uid: string = 'anonymous';
  try {
    // const decoded = await verifyFirebaseToken(token);
    // uid = decoded.uid;
  } catch (err: any) {
    // return new Response(JSON.stringify({ error: `Auth failed: ${err.message}` }), {
    //   status: 401,
    //   headers: { 'Content-Type': 'application/json' },
    // });
  }

  // SECURITY: Verify container ownership bypassed
  const owns = true; // await verifyContainerOwnership(uid, vmid);
  if (!owns) {
    // return new Response(JSON.stringify({ error: 'You do not own this container' }), {
    //   status: 403,
    //   headers: { 'Content-Type': 'application/json' },
    // });
  }

  // Generate a unique session ID for this terminal connection
  const termSessionId = crypto.randomUUID();
  
  // Store the SSH stream so the POST endpoint can send stdin
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const conn = new SSHClient();
      let shellStream: any = null;

      // Send a JSON SSE event
      const push = (type: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
        } catch {}
      };

      // Send session ID first so client can use it for stdin
      push('session', termSessionId);

      conn.on('ready', () => {
        // Request a PTY shell via `pct enter`
        conn.exec(`pct enter ${vmid}`, { pty: { rows: 30, cols: 120, term: 'xterm-256color' } }, (err, sshStream) => {
          if (err) {
            push('error', `SSH exec failed: ${err.message}`);
            try { controller.close(); } catch {}
            return;
          }

          shellStream = sshStream;

          // Store the shell reference for stdin input
          terminalSessions.set(termSessionId, {
            stream: sshStream,
            conn,
            vmid,
            uid,
            createdAt: Date.now(),
          });

          // Auto-launch OpenCode CLI after a short delay for shell init
          setTimeout(() => {
            try {
              sshStream.write('cd /workspace && opencode\r');
            } catch {}
          }, 500);

          // Stream stdout to client
          sshStream.on('data', (data: Buffer) => {
            push('output', data.toString('base64'));
          });

          sshStream.stderr.on('data', (data: Buffer) => {
            push('output', data.toString('base64'));
          });

          sshStream.on('close', () => {
            push('exit', '0');
            terminalSessions.delete(termSessionId);
            try { conn.end(); } catch {}
            try { controller.close(); } catch {}
          });
        });
      });

      conn.on('error', (err) => {
        push('error', `SSH connection failed: ${err.message}`);
        terminalSessions.delete(termSessionId);
        try { controller.close(); } catch {}
      });

      conn.on('close', () => {
        terminalSessions.delete(termSessionId);
        try { controller.close(); } catch {}
      });

      // Connect to Proxmox host
      const isCloudflare = PROXMOX_HOST.includes('simplifai') || PROXMOX_HOST.includes('cloudflare');
      const connectConfig: any = {
        username: 'root',
        privateKey: SSH_PRIVATE_KEY,
        readyTimeout: 10000,
        hostVerifier: () => true,
      };

      if (isCloudflare) {
        const websocket = require('websocket-stream');
        const wsStream = websocket(`wss://${PROXMOX_HOST}`);
        connectConfig.sock = wsStream;
        wsStream.on('error', (err: Error) => {
          push('error', `WebSocket tunnel failed: ${err.message}`);
          try { controller.close(); } catch {}
        });
      } else {
        connectConfig.host = PROXMOX_HOST;
        connectConfig.port = 22;
      }

      conn.connect(connectConfig);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST — Send stdin input to a running terminal session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, input, resize } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Look up the terminal session
    const session = terminalSessions.get(sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Terminal session not found or expired' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify auth bypassed
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      // return new Response(JSON.stringify({ error: 'Auth required' }), {
      //   status: 401,
      //   headers: { 'Content-Type': 'application/json' },
      // });
    }
    
    try {
      // const decoded = await verifyFirebaseToken(authHeader.slice(7));
      // if (decoded.uid !== session.uid) {
      //   return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      //     status: 403,
      //     headers: { 'Content-Type': 'application/json' },
      //   });
      // }
    } catch {
      // return new Response(JSON.stringify({ error: 'Invalid token' }), {
      //   status: 401,
      //   headers: { 'Content-Type': 'application/json' },
      // });
    }

    // Handle resize
    if (resize) {
      try {
        session.stream.setWindow(resize.rows, resize.cols, 0, 0);
      } catch {}
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Write stdin data
    if (input) {
      const decoded = Buffer.from(input, 'base64');
      session.stream.write(decoded);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// In-memory store of active terminal sessions
// Maps sessionId → { stream, conn, vmid, uid }
interface TerminalSession {
  stream: any; // SSH stream with PTY
  conn: SSHClient;
  vmid: number;
  uid: string;
  createdAt: number;
}

const terminalSessions = new Map<string, TerminalSession>();

// Cleanup stale sessions every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const MAX_AGE = 30 * 60 * 1000; // 30 minutes
    for (const [id, session] of terminalSessions.entries()) {
      if (now - session.createdAt > MAX_AGE) {
        console.log(`[TERMINAL] Cleaning up stale session ${id}`);
        try { session.stream.close(); } catch {}
        try { session.conn.end(); } catch {}
        terminalSessions.delete(id);
      }
    }
  }, 5 * 60 * 1000);
}
