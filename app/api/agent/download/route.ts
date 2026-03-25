/**
 * Agent Download API — Secure file download from a Proxmox container.
 * 
 * GET /api/agent/download?vmid={vmid}&path={filepath}&token={idToken}
 * 
 * Reads a file from the container via `pct exec {vmid} -- cat {filepath}`,
 * then streams it back with the correct Content-Type and Content-Disposition.
 * 
 * SECURITY: Requires valid Firebase ID token + container ownership.
 */

import { NextRequest } from 'next/server';
import { verifyFirebaseToken } from '@/app/lib/firebaseAdmin';
import { verifyContainerOwnership } from '@/app/lib/verifyAuth';
import { execCommand } from '@/app/lib/ssh';

// Map file extensions to MIME types
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.html': 'text/html',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.py': 'text/x-python',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.sh': 'text/x-shellscript',
};

function getMimeType(filepath: string): string {
  const ext = filepath.slice(filepath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// Security: Only allow downloads from safe paths
const ALLOWED_PREFIXES = ['/workspace/', '/tmp/', '/root/', '/home/'];
const BLOCKED_PATHS = ['/etc/shadow', '/etc/passwd', '/proc/', '/sys/', '/dev/'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vmidStr = searchParams.get('vmid');
  const filepath = searchParams.get('path');
  const token = searchParams.get('token');

  if (!vmidStr || !filepath || !token) {
    return new Response(JSON.stringify({ error: 'vmid, path, and token are required' }), {
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

  // Security: Path validation
  const normalizedPath = filepath.replace(/\.\./g, ''); // Strip path traversal
  if (BLOCKED_PATHS.some(bp => normalizedPath.startsWith(bp))) {
    return new Response(JSON.stringify({ error: 'Access to this path is restricted' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!ALLOWED_PREFIXES.some(pfx => normalizedPath.startsWith(pfx))) {
    return new Response(JSON.stringify({ error: 'Downloads are only allowed from /workspace/, /tmp/, /root/, /home/' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SECURITY: Verify Firebase token
  let uid: string;
  try {
    const decoded = await verifyFirebaseToken(token);
    uid = decoded.uid;
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Auth failed: ${err.message}` }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SECURITY: Verify container ownership
  const owns = await verifyContainerOwnership(uid, vmid);
  if (!owns) {
    return new Response(JSON.stringify({ error: 'You do not own this container' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Read the file from the container as base64 to handle binary files
    const result = await execCommand(vmid, `base64 "${normalizedPath}"`);

    if (result.exitCode !== 0) {
      return new Response(JSON.stringify({ 
        error: result.stderr || `File not found: ${normalizedPath}` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Decode base64 → binary
    const base64Data = result.stdout.replace(/\s/g, '');
    const binaryData = Buffer.from(base64Data, 'base64');

    // Extract filename
    const filename = normalizedPath.split('/').pop() || 'download';
    const mimeType = getMimeType(filename);

    return new Response(binaryData, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(binaryData.length),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    console.error('[DOWNLOAD] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message || 'Download failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
