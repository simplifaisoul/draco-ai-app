/**
 * Agent Files API — Lists manageable files in the container workspace.
 * 
 * GET /api/agent/files?vmid={vmid}&token={idToken}
 * 
 * Returns a JSON array of files: { name: string, size: number, modifiedAt: number }
 */

import { NextRequest } from 'next/server';
import { execCommand } from '@/app/lib/ssh';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vmidStr = searchParams.get('vmid');

  if (!vmidStr) {
    return new Response(JSON.stringify({ error: 'vmid is required' }), {
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

  try {
    // List only files in /workspace, extracting timestamp, size, and name separated by a pipe
    const result = await execCommand(vmid, `find /workspace -maxdepth 1 -type f -printf "%Ts|%s|%f\\n" 2>/dev/null || true`);

    if (result.exitCode !== 0 && !result.stdout) {
      return new Response(JSON.stringify({ error: 'Failed to read workspace' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const outputLines = result.stdout.trim().split('\n').filter(Boolean);
    
    const files = outputLines.map(line => {
      const [timestamp, sizeStr, name] = line.split('|');
      return {
        name: name || '',
        size: parseInt(sizeStr || '0', 10),
        modifiedAt: parseInt(timestamp || '0', 10) * 1000 // Convert to ms
      };
    }).filter(f => f.name && f.name !== '.bash_history'); // hide hidden dotfiles safely if needed, or just specific ones

    // Sort newest first
    files.sort((a, b) => b.modifiedAt - a.modifiedAt);

    return new Response(JSON.stringify({ files }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0'
      },
    });

  } catch (error: any) {
    console.error('Agent Files API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
