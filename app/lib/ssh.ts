/**
 * SSH Command Executor for Draco Agent
 * Executes commands inside LXC containers via SSH
 */

import { Client as SSHClient } from 'ssh2';

const SSH_PRIVATE_KEY = process.env.PROXMOX_SSH_PRIVATE_KEY
  ? Buffer.from(process.env.PROXMOX_SSH_PRIVATE_KEY, 'base64').toString('utf-8')
  : '';
const PROXMOX_HOST = process.env.PROXMOX_SSH_HOST || 'ssh.simplifai-1.org';

const MAX_OUTPUT_SIZE = 5 * 1024 * 1024; // 5MB per command output (needed for file downloads)
const COMMAND_TIMEOUT = 120000; // 120 seconds (apt operations need time)

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a command inside a container via SSH through the Proxmox host.
 * Uses `pct exec <vmid> -- <command>` on the Proxmox host.
 */
export async function execCommand(vmid: number, command: string): Promise<ExecResult> {
  // We SSH into the Proxmox host and use `pct exec` to run commands in the container
  const wrappedCommand = `pct exec ${vmid} -- bash -c ${escapeShellArg(command)}`;
  
  return sshExec(PROXMOX_HOST, 'root', wrappedCommand);
}

/**
 * Execute a command with STREAMING output — chunks are pushed via callbacks as they arrive.
 * This is used for the real-time terminal experience.
 */
export function execCommandStreaming(
  vmid: number,
  command: string,
  callbacks: {
    onData: (chunk: string) => void;
    onStderr: (chunk: string) => void;
    onClose: (exitCode: number) => void;
    onError: (error: Error) => void;
  }
): { abort: () => void } {
  const wrappedCommand = `pct exec ${vmid} -- bash -c ${escapeShellArg(command)}`;
  const conn = new SSHClient();
  let timedOut = false;
  let totalOutput = 0;

  const timer = setTimeout(() => {
    timedOut = true;
    callbacks.onData('\n...(command timed out after ' + (COMMAND_TIMEOUT / 1000) + 's)\n');
    callbacks.onClose(124);
    try { conn.end(); } catch {}
  }, COMMAND_TIMEOUT);

  conn.on('ready', () => {
    conn.exec(wrappedCommand, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        conn.end();
        callbacks.onError(err);
        return;
      }

      stream.on('data', (data: Buffer) => {
        if (timedOut) return;
        const chunk = data.toString();
        totalOutput += chunk.length;
        if (totalOutput <= MAX_OUTPUT_SIZE) {
          callbacks.onData(chunk);
        } else if (totalOutput - chunk.length < MAX_OUTPUT_SIZE) {
          callbacks.onData('\n...(output truncated)\n');
        }
      });

      stream.stderr.on('data', (data: Buffer) => {
        if (timedOut) return;
        callbacks.onStderr(data.toString());
      });

      stream.on('close', (code: number) => {
        clearTimeout(timer);
        if (!timedOut) {
          conn.end();
          callbacks.onClose(code ?? 0);
        }
      });
    });
  });

  conn.on('error', (err) => {
    clearTimeout(timer);
    callbacks.onError(new Error(`SSH connection failed: ${err.message}`));
  });

  // Connect with same logic as sshExec
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
      clearTimeout(timer);
      callbacks.onError(new Error(`WebSocket tunnel failed: ${err.message}`));
    });
  } else {
    connectConfig.host = PROXMOX_HOST;
    connectConfig.port = 22;
  }

  conn.connect(connectConfig);

  return {
    abort: () => {
      clearTimeout(timer);
      try { conn.end(); } catch {}
    },
  };
}

/**
 * Execute a command on the Proxmox host directly (for setup tasks).
 */
export async function execOnHost(command: string): Promise<ExecResult> {
  return sshExec(PROXMOX_HOST, 'root', command);
}

/**
 * Core SSH execution function
 */
function sshExec(host: string, username: string, command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      conn.end();
      resolve({
        stdout: stdout + `\n...(command timed out after ${COMMAND_TIMEOUT / 1000}s)`,
        stderr,
        exitCode: 124, // Standard timeout exit code
      });
    }, COMMAND_TIMEOUT);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          reject(err);
          return;
        }

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
          // Truncate if too large
          if (stdout.length > MAX_OUTPUT_SIZE) {
            stdout = stdout.slice(0, MAX_OUTPUT_SIZE) + '\n...(output truncated)';
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
          if (stderr.length > MAX_OUTPUT_SIZE) {
            stderr = stderr.slice(0, MAX_OUTPUT_SIZE) + '\n...(stderr truncated)';
          }
        });

        stream.on('close', (code: number) => {
          clearTimeout(timer);
          if (!timedOut) {
            conn.end();
            resolve({
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: code ?? 0,
            });
          }
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`SSH connection failed: ${err.message}`));
    });

    const isCloudflare = host.includes('simplifai') || host.includes('cloudflare');
    const connectConfig: any = {
      username,
      privateKey: SSH_PRIVATE_KEY,
      readyTimeout: 10000,
      hostVerifier: () => true, // Allow self-signed / dynamic IPs
    };

    if (isCloudflare) {
      // Bypass Cloudflare TCP blocks by wrapping SSH in a secure WebSocket
      const websocket = require('websocket-stream');
      const wsStream = websocket(`wss://${host}`);
      connectConfig.sock = wsStream;
      
      // If the websocket drops before ssh2 is ready, reject
      wsStream.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(new Error(`WebSocket tunnel failed: ${err.message}`));
      });
    } else {
      // Standard raw TCP fallback
      connectConfig.host = host;
      connectConfig.port = 22;
    }

    conn.connect(connectConfig);
  });
}

/**
 * Escape a string for safe use in a shell command
 */
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Setup a fresh container after boot.
 * Installs essential tools so users can immediately install software like OpenClaw.
 */
export async function setupContainer(vmid: number): Promise<void> {
  const setupCommands = [
    // Wait for network connectivity
    'for i in $(seq 1 15); do ping -c1 8.8.8.8 > /dev/null 2>&1 && break || sleep 2; done',
    // Install essential tools in one shot (curl, git, wget, sudo, nano, locales)
    'apt-get update -qq && apt-get install -y -qq curl git wget sudo nano locales ca-certificates > /dev/null 2>&1',
    // Fix locale warnings
    'locale-gen en_US.UTF-8 > /dev/null 2>&1 && update-locale LANG=en_US.UTF-8 > /dev/null 2>&1',
    // Create workspace directory
    'mkdir -p /workspace',
    // Set a nice prompt
    'echo \'export PS1="\\[\\e[1;32m\\]root@draco\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ "\' >> /root/.bashrc',
    // Default cd to workspace
    'echo "cd /workspace" >> /root/.bashrc',
  ];

  for (const cmd of setupCommands) {
    try {
      await execCommand(vmid, cmd);
    } catch (err) {
      console.error(`Setup command failed: ${cmd}`, err);
    }
  }
}

