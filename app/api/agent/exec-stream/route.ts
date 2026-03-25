/**
 * Streaming Exec API — SSE endpoint that streams command output in real-time.
 * Each stdout/stderr chunk is pushed as an SSE event as it arrives from the SSH session.
 * 
 * SECURITY: Requires valid Firebase ID token (Bearer auth) + container ownership.
 */

import { NextRequest } from 'next/server';
import { execCommandStreaming } from '@/app/lib/ssh';
import { verifyAuth, verifyContainerOwnership, authErrorResponse } from '@/app/lib/verifyAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vmid, command } = body;

    if (!vmid || !command) {
      return new Response(JSON.stringify({ error: 'vmid and command are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // SECURITY: Verify Firebase ID token
    const auth = await verifyAuth(request, body);
    if (!auth.success) {
      return authErrorResponse(auth);
    }

    // SECURITY: Verify container ownership
    const owns = await verifyContainerOwnership(auth.user.uid, vmid);
    if (!owns) {
      return new Response(JSON.stringify({ error: 'You do not have access to this container' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Security: blocklist for destructive commands
    const dangerous = [
      'rm -rf /', 'mkfs', ':(){', 'dd if=/dev/zero',
      'chmod -R 777 /', 'chown -R', '> /dev/sda',
      '/proc/sysrq', 'mount -o remount',
    ];
    if (dangerous.some(d => command.toLowerCase().includes(d))) {
      return new Response(JSON.stringify({ error: 'Command blocked for safety' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Security: allowlist for base commands
    const allowedCommands = [
      "ls", "cd", "pwd", "rm", "rmdir", "mkdir", "mv", "cp", "touch", "ln",
      "chmod", "chown", "stat", "file", "realpath", "dirname", "basename",
      "cat", "echo", "grep", "find", "sed", "awk", "head", "tail", "wc",
      "sort", "uniq", "cut", "tr", "tee", "xargs", "diff", "less", "more",
      "curl", "wget", "ping", "ip", "ss", "nc", "nslookup", "dig", "ssh", "scp", "rsync",
      "apt", "apt-get", "dpkg", "npm", "npx", "yarn", "pnpm", "pip", "pip3",
      "node", "python", "python3", "bash", "sh", "env",
      "sudo", "systemctl", "journalctl", "dmesg", "ps", "kill", "top", "htop",
      "free", "df", "du", "uname", "hostname", "whoami", "id", "date", "sleep",
      "locale-gen", "update-locale", "which", "man", "export", "source",
      "tar", "gzip", "gunzip", "zip", "unzip", "bzip2",
      "nano", "vi", "vim",
      "git", "make", "gcc", "g++", "cargo", "rustc", "go", "java", "javac",
      "docker", "docker-compose", "openclaw",
      "test", "[", "true", "false", "for", "while", "if",
    ];

    const cmdParts = command.trim().split(/\s+/);
    let baseCmd = cmdParts[0];
    if (baseCmd.includes('=') && cmdParts.length > 1) baseCmd = cmdParts[1];
    if (baseCmd === 'sudo' && cmdParts.length > 1) baseCmd = cmdParts[1];

    if (!allowedCommands.includes(baseCmd)) {
      return new Response(JSON.stringify({ error: `Command '${baseCmd}' is not in the allowed list.` }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const push = (type: string, data: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
          } catch {}
        };

        const handle = execCommandStreaming(vmid, command, {
          onData: (chunk) => push('stdout', chunk),
          onStderr: (chunk) => push('stderr', chunk),
          onClose: (exitCode) => {
            push('exit', String(exitCode));
            try {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch {}
          },
          onError: (error) => {
            push('error', error.message);
            try {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch {}
          },
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Streaming exec error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
