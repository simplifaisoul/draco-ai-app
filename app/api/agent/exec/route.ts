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

    // Sanitize: block dangerous commands
    const dangerous = [
      'rm -rf /', 'mkfs', ':(){', 'dd if=/dev/zero',
      'chmod -R 777 /', 'chown -R', '> /dev/sda',
      'wget -O- | sh', 'curl | sh', 'nsenter',
      '/proc/sysrq', 'mount -o remount',
    ];
    if (dangerous.some(d => command.toLowerCase().includes(d))) {
      return NextResponse.json(
        { error: 'Command blocked for safety' },
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
