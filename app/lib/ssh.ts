/**
 * SSH Command Executor for Draco Agent
 * Executes commands inside LXC containers via SSH
 */

import { Client as SSHClient } from 'ssh2';

const SSH_PRIVATE_KEY = process.env.PROXMOX_SSH_PRIVATE_KEY
  ? Buffer.from(process.env.PROXMOX_SSH_PRIVATE_KEY, 'base64').toString('utf-8')
  : '';
const PROXMOX_HOST = process.env.PROXMOX_SSH_HOST || 'ssh.simplifai-1.org';

const MAX_OUTPUT_SIZE = 10 * 1024; // 10KB per command output
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

    conn.connect({
      host,
      port: 22,
      username,
      privateKey: SSH_PRIVATE_KEY,
      readyTimeout: 10000,
      // Allow self-signed host keys
      hostVerifier: () => true,
    });
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
 * IMPORTANT: No apt-get here — we don't want to hold apt locks.
 * Users should run their own apt-get update/install as needed.
 */
export async function setupContainer(vmid: number): Promise<void> {
  const setupCommands = [
    // Wait for network connectivity
    'for i in $(seq 1 15); do ping -c1 8.8.8.8 > /dev/null 2>&1 && break || sleep 2; done',
    // Create workspace directory
    'mkdir -p /workspace',
    // Set a nice prompt
    'echo \'export PS1="\\[\\e[1;32m\\]root@draco\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ "\' >> /root/.bashrc',
  ];

  for (const cmd of setupCommands) {
    try {
      await execCommand(vmid, cmd);
    } catch (err) {
      console.error(`Setup command failed: ${cmd}`, err);
    }
  }
}

