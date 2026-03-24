/**
 * Agent Diagnostic Endpoint — Tests Proxmox API and SSH connectivity
 * GET /api/agent/diagnose — Returns full system status
 */

import { NextRequest, NextResponse } from 'next/server';
import { listContainers, getContainerStatus } from '@/app/lib/proxmox';

export async function GET(request: NextRequest) {
  // SECURITY: Only available in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      PROXMOX_API_URL: process.env.PROXMOX_API_URL ? 'SET' : 'NOT SET',
      PROXMOX_NODE: process.env.PROXMOX_NODE || 'NOT SET',
      PROXMOX_SSH_HOST: process.env.PROXMOX_SSH_HOST ? 'SET' : 'NOT SET',
      PROXMOX_API_TOKEN: process.env.PROXMOX_API_TOKEN ? 'SET' : 'NOT SET',
      PROXMOX_SSH_PRIVATE_KEY: process.env.PROXMOX_SSH_PRIVATE_KEY ? 'SET' : 'NOT SET',
      PROXMOX_SSH_PUB_KEY: process.env.PROXMOX_SSH_PUB_KEY ? 'SET' : 'NOT SET',
    },
  };

  // Test 1: Proxmox API connectivity
  try {
    const containers = await listContainers();
    results.proxmoxAPI = {
      status: 'OK',
      containerCount: containers.length,
      containers: containers.map((c: any) => ({
        vmid: c.vmid,
        name: c.name,
        status: c.status,
      })),
    };
  } catch (err: any) {
    results.proxmoxAPI = {
      status: 'FAILED',
      error: err.message,
    };
  }

  // Test 2: SSH private key decoding
  try {
    const keyBase64 = process.env.PROXMOX_SSH_PRIVATE_KEY || '';
    const decoded = Buffer.from(keyBase64, 'base64').toString('utf-8');
    const isValid = decoded.includes('BEGIN') && decoded.includes('PRIVATE KEY');
    results.sshKey = {
      status: isValid ? 'OK' : 'INVALID',
      decoded_length: decoded.length,
      starts_with: decoded.substring(0, 40),
      ends_with: decoded.substring(decoded.length - 40),
    };
  } catch (err: any) {
    results.sshKey = {
      status: 'FAILED',
      error: err.message,
    };
  }

  // Test 3: SSH connection test
  try {
    const { Client: SSHClient } = await import('ssh2');
    const keyBase64 = process.env.PROXMOX_SSH_PRIVATE_KEY || '';
    const privateKey = Buffer.from(keyBase64, 'base64').toString('utf-8');
    
    const sshResult = await new Promise<any>((resolve) => {
      const conn = new SSHClient();
      const timeout = setTimeout(() => {
        conn.end();
        resolve({ status: 'TIMEOUT', error: 'Connection timed out after 10s' });
      }, 10000);

      conn.on('ready', () => {
        clearTimeout(timeout);
        conn.exec('hostname && whoami && pct list 2>/dev/null || echo "pct not available"', (err, stream) => {
          if (err) {
            conn.end();
            resolve({ status: 'EXEC_FAILED', error: err.message });
            return;
          }
          let output = '';
          stream.on('data', (data: Buffer) => { output += data.toString(); });
          stream.stderr.on('data', (data: Buffer) => { output += '[STDERR] ' + data.toString(); });
          stream.on('close', (code: number) => {
            conn.end();
            resolve({ status: 'OK', output: output.trim(), exitCode: code });
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ status: 'FAILED', error: err.message });
      });

      conn.connect({
        host: process.env.PROXMOX_SSH_HOST || '100.68.100.15',
        port: 22,
        username: 'root',
        privateKey,
        readyTimeout: 10000,
        hostVerifier: () => true,
      });
    });

    results.ssh = sshResult;
  } catch (err: any) {
    results.ssh = {
      status: 'FAILED',
      error: err.message,
    };
  }

  return NextResponse.json(results, { status: 200 });
}
