/**
 * Agent Exec API — Execute a command inside an agent container
 * 
 * SECURITY: Requires valid Firebase ID token (Bearer auth) + container ownership.
 */

import { NextRequest, NextResponse } from 'next/server';
import { execCommand, type ExecResult } from '@/app/lib/ssh';
import { verifyAuth, verifyContainerOwnership, authErrorResponse } from '@/app/lib/verifyAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vmid, command } = body;

    if (!vmid || !command) {
      return NextResponse.json(
        { error: 'vmid and command are required' },
        { status: 400 }
      );
    }

    // SECURITY: Verify Firebase ID token
    const auth = await verifyAuth(request, body);
    if (!auth.success) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify container ownership
    const owns = await verifyContainerOwnership(auth.user.uid, vmid);
    if (!owns) {
      return NextResponse.json(
        { error: 'You do not have access to this container' },
        { status: 403 }
      );
    }

    // Sanitize: block dangerous commands
    const dangerous = [
      'rm -rf /', 'mkfs', ':(){', 'dd if=/dev/zero',
      'chmod -R 777 /', 'chown -R', '> /dev/sda',
      '/proc/sysrq', 'mount -o remount',
    ];
    if (dangerous.some(d => command.toLowerCase().includes(d))) {
      return NextResponse.json(
        { error: 'Command blocked for safety' },
        { status: 403 }
      );
    }

    // Security: Strict Allowlist
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
      console.warn(`[SECURITY] Blocked non-allowlisted command: ${baseCmd}`);
      return NextResponse.json(
        { error: `Command '${baseCmd}' is not in the allowed list.` },
        { status: 403 }
      );
    }

    const result: ExecResult = await execCommand(vmid, command);

    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  } catch (error: any) {
    console.error('Exec error:', error);
    return NextResponse.json(
      { error: error.message || 'Command execution failed' },
      { status: 500 }
    );
  }
}
