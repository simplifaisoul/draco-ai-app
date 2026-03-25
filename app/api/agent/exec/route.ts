/**
 * Agent Exec API — Execute a command inside an agent container
 */

import { NextRequest, NextResponse } from 'next/server';
import { execCommand, type ExecResult } from '@/app/lib/ssh';

export async function POST(request: NextRequest) {
  try {
    const { vmid, command, userId } = await request.json();

    if (!vmid || !command) {
      return NextResponse.json(
        { error: 'vmid and command are required' },
        { status: 400 }
      );
    }

    // SECURITY: Require valid userId
    if (!userId || typeof userId !== 'string' || userId.length < 5) {
      return NextResponse.json(
        { error: 'Valid userId required' },
        { status: 401 }
      );
    }

    // Sanitize: block dangerous commands (keep existing blocklist for specific args)
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

    // Security: Strict Allowlist — all standard Linux and dev tooling
    const allowedCommands = [
      // Filesystem
      "ls", "cd", "pwd", "rm", "rmdir", "mkdir", "mv", "cp", "touch", "ln",
      "chmod", "chown", "stat", "file", "realpath", "dirname", "basename",
      // Text / IO
      "cat", "echo", "grep", "find", "sed", "awk", "head", "tail", "wc",
      "sort", "uniq", "cut", "tr", "tee", "xargs", "diff", "less", "more",
      // Networking
      "curl", "wget", "ping", "ip", "ss", "nc", "nslookup", "dig", "ssh", "scp", "rsync",
      // Package managers
      "apt", "apt-get", "dpkg", "npm", "npx", "yarn", "pnpm", "pip", "pip3",
      // Runtimes
      "node", "python", "python3", "bash", "sh", "env",
      // System
      "sudo", "systemctl", "journalctl", "dmesg", "ps", "kill", "top", "htop",
      "free", "df", "du", "uname", "hostname", "whoami", "id", "date", "sleep",
      "locale-gen", "update-locale", "which", "man", "export", "source",
      // Compression
      "tar", "gzip", "gunzip", "zip", "unzip", "bzip2",
      // Editors
      "nano", "vi", "vim",
      // Dev tools
      "git", "make", "gcc", "g++", "cargo", "rustc", "go", "java", "javac",
      // Containers & AI
      "docker", "docker-compose", "openclaw",
      // Script execution
      "test", "[", "true", "false", "for", "while", "if",
    ];

    // Get the base command (e.g. "sudo apt update" -> "sudo", or if sudo, check next word)
    const cmdParts = command.trim().split(/\s+/);
    let baseCmd = cmdParts[0];

    // If the command is variable assignment like VAR=value, extract the real command
    if (baseCmd.includes('=') && cmdParts.length > 1) {
      baseCmd = cmdParts[1];
    }
    
    if (baseCmd === 'sudo' && cmdParts.length > 1) {
      baseCmd = cmdParts[1];
    }

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
