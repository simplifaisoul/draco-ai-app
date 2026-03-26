/**
 * AgentShell — Persistent PTY Shell Manager
 * 
 * Instead of stateless `pct exec` calls that forget directory state and env vars,
 * this opens a persistent `pct enter {vmid}` session over SSH and keeps it alive.
 * 
 * Commands are injected into stdin with a sentinel suffix so we know when output
 * is complete. This gives us:
 *  - cd persistence across commands
 *  - environment variable persistence
 *  - running background processes
 *  - real-time streaming output
 */

import { Client as SSHClient } from 'ssh2';

const SSH_PRIVATE_KEY = process.env.PROXMOX_SSH_PRIVATE_KEY
  ? Buffer.from(process.env.PROXMOX_SSH_PRIVATE_KEY, 'base64').toString('utf-8')
  : '';
const PROXMOX_HOST = process.env.PROXMOX_SSH_HOST || 'ssh.simplifai-1.org';

// Unique sentinel that marks end of command output
const SENTINEL_PREFIX = '___DRACO_DONE_';
const SENTINEL_REGEX = /___DRACO_DONE_(\d+)___/;

// Max time to wait for a single command's output
const COMMAND_TIMEOUT = 120_000; // 2 minutes

// Max shell session lifetime
const SHELL_TTL = 30 * 60 * 1000; // 30 minutes

export interface CommandResult {
  stdout: string;
  exitCode: number;
}

export type OutputCallback = (chunk: string) => void;

export class AgentShell {
  private conn: SSHClient | null = null;
  private shellStream: any = null;
  private buffer: string = '';
  private commandResolve: ((result: CommandResult) => void) | null = null;
  private commandReject: ((err: Error) => void) | null = null;
  private outputCallback: OutputCallback | null = null;
  private commandOutput: string = '';
  private isReady: boolean = false;
  private createdAt: number = Date.now();
  private _destroyed: boolean = false;

  readonly vmid: number;
  readonly sessionId: string;

  constructor(vmid: number, sessionId: string) {
    this.vmid = vmid;
    this.sessionId = sessionId;
  }

  /**
   * Initialize the persistent shell connection.
   * Opens SSH → runs `pct enter {vmid}` → waits for shell prompt.
   */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this._destroyed) {
        reject(new Error('Shell has been destroyed'));
        return;
      }

      this.conn = new SSHClient();
      const connectTimeout = setTimeout(() => {
        reject(new Error('SSH connection timeout (10s)'));
        this.destroy();
      }, 10000);

      this.conn.on('ready', () => {
        clearTimeout(connectTimeout);

        this.conn!.exec(
          `pct enter ${this.vmid}`,
          { pty: { rows: 50, cols: 200, term: 'xterm-256color' } },
          (err, stream) => {
            if (err) {
              reject(new Error(`Failed to enter container: ${err.message}`));
              return;
            }

            this.shellStream = stream;

            // Accumulate output and check for sentinel
            stream.on('data', (data: Buffer) => {
              const text = data.toString();
              this.buffer += text;

              // Stream raw output to callback (for real-time terminal display)
              if (this.outputCallback) {
                this.outputCallback(text);
              }

              // Also accumulate for command result parsing
              if (this.commandResolve) {
                this.commandOutput += text;
                this.checkSentinel();
              }
            });

            stream.stderr.on('data', (data: Buffer) => {
              const text = data.toString();
              if (this.outputCallback) {
                this.outputCallback(text);
              }
              if (this.commandResolve) {
                this.commandOutput += text;
              }
            });

            stream.on('close', () => {
              this.isReady = false;
              if (this.commandReject) {
                this.commandReject(new Error('Shell closed unexpectedly'));
                this.commandResolve = null;
                this.commandReject = null;
              }
            });

            // Wait a moment for the shell prompt to appear, then mark ready
            setTimeout(() => {
              // Disable echo and set a clean prompt to avoid noise
              this.shellStream.write('export PS1=""\n');
              setTimeout(() => {
                this.shellStream.write('stty -echo 2>/dev/null\n');
                setTimeout(() => {
                  this.buffer = '';
                  this.isReady = true;
                  resolve();
                }, 300);
              }, 200);
            }, 500);
          }
        );
      });

      this.conn.on('error', (err) => {
        clearTimeout(connectTimeout);
        reject(new Error(`SSH error: ${err.message}`));
      });

      // Connect via Cloudflare WebSocket or direct TCP
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
          clearTimeout(connectTimeout);
          reject(new Error(`WebSocket tunnel failed: ${err.message}`));
        });
      } else {
        connectConfig.host = PROXMOX_HOST;
        connectConfig.port = 22;
      }

      this.conn.connect(connectConfig);
    });
  }

  /**
   * Run a command in the persistent shell.
   * Injects it with a sentinel suffix so we know when output is done.
   * Streams output in real-time via the onOutput callback.
   */
  async runCommand(
    command: string,
    onOutput?: OutputCallback,
    timeoutMs: number = COMMAND_TIMEOUT
  ): Promise<CommandResult> {
    if (!this.isReady || !this.shellStream) {
      throw new Error('Shell is not ready. Call connect() first.');
    }

    if (this._destroyed) {
      throw new Error('Shell has been destroyed');
    }

    // Wait if another command is still running
    if (this.commandResolve) {
      throw new Error('Another command is already running');
    }

    return new Promise<CommandResult>((resolve, reject) => {
      this.commandResolve = resolve;
      this.commandReject = reject;
      this.commandOutput = '';
      this.outputCallback = onOutput || null;

      // Timeout protection
      const timer = setTimeout(() => {
        const output = this.commandOutput;
        this.commandResolve = null;
        this.commandReject = null;
        this.outputCallback = null;
        resolve({
          stdout: output + '\n...(command timed out after ' + (timeoutMs / 1000) + 's)',
          exitCode: 124,
        });
      }, timeoutMs);

      // Inject command with sentinel
      // The sentinel echoes the exit code of the previous command
      const wrappedCommand = `${command}; echo "${SENTINEL_PREFIX}$?___"\n`;
      this.shellStream.write(wrappedCommand);

      // Store timeout so we can clear it when sentinel arrives
      (this as any)._commandTimer = timer;
    });
  }

  /**
   * Check if the accumulated output contains our sentinel marker.
   */
  private checkSentinel(): void {
    const match = SENTINEL_REGEX.exec(this.commandOutput);
    if (match && this.commandResolve) {
      const exitCode = parseInt(match[1]) || 0;

      // Extract output before the sentinel (remove the sentinel line itself)
      let stdout = this.commandOutput.slice(0, match.index);

      // Clean up: remove the echo of the command itself from the top
      // The first line often contains the command we sent
      const lines = stdout.split('\n');
      // Remove leading empty lines and the echoed command
      while (lines.length > 0 && (lines[0].trim() === '' || lines[0].includes(SENTINEL_PREFIX))) {
        lines.shift();
      }
      // Remove the sentinel echo line from the end
      while (lines.length > 0 && (lines[lines.length - 1].trim() === '' || lines[lines.length - 1].includes(SENTINEL_PREFIX))) {
        lines.pop();
      }
      stdout = lines.join('\n').trim();

      // Clear the command timer
      if ((this as any)._commandTimer) {
        clearTimeout((this as any)._commandTimer);
        (this as any)._commandTimer = null;
      }

      const resolve = this.commandResolve;
      this.commandResolve = null;
      this.commandReject = null;
      this.outputCallback = null;
      this.commandOutput = '';

      resolve({ stdout, exitCode });
    }
  }

  /**
   * Destroy the shell connection and clean up.
   */
  destroy(): void {
    this._destroyed = true;
    this.isReady = false;

    if (this.commandReject) {
      this.commandReject(new Error('Shell destroyed'));
      this.commandResolve = null;
      this.commandReject = null;
    }

    try { this.shellStream?.close(); } catch {}
    try { this.conn?.end(); } catch {}

    this.shellStream = null;
    this.conn = null;
  }

  get alive(): boolean {
    return this.isReady && !this._destroyed;
  }

  get age(): number {
    return Date.now() - this.createdAt;
  }

  get expired(): boolean {
    return this.age > SHELL_TTL;
  }
}

// ── Global Shell Pool ──
// Maps sessionId → AgentShell
const shellPool = new Map<string, AgentShell>();

/**
 * Get or create a persistent shell for a session.
 */
export async function getOrCreateShell(vmid: number, sessionId: string): Promise<AgentShell> {
  // Check for existing shell
  const existing = shellPool.get(sessionId);
  if (existing && existing.alive && !existing.expired) {
    return existing;
  }

  // Destroy old shell if expired
  if (existing) {
    existing.destroy();
    shellPool.delete(sessionId);
  }

  // Create new shell
  const shell = new AgentShell(vmid, sessionId);
  await shell.connect();
  shellPool.set(sessionId, shell);

  console.log(`[AGENT_SHELL] Created persistent shell for CT ${vmid} (session ${sessionId.slice(0, 8)})`);
  return shell;
}

/**
 * Destroy a shell for a session.
 */
export function destroyShell(sessionId: string): void {
  const shell = shellPool.get(sessionId);
  if (shell) {
    shell.destroy();
    shellPool.delete(sessionId);
    console.log(`[AGENT_SHELL] Destroyed shell for session ${sessionId.slice(0, 8)}`);
  }
}

// Cleanup expired shells every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    for (const [id, shell] of shellPool.entries()) {
      if (shell.expired || !shell.alive) {
        console.log(`[AGENT_SHELL] Cleaning up expired shell for session ${id.slice(0, 8)}`);
        shell.destroy();
        shellPool.delete(id);
      }
    }
  }, 5 * 60 * 1000);
}
