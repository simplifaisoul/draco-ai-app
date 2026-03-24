/**
 * Agent Cleanup Endpoint — Destroys all draco containers
 * POST /api/agent/cleanup — Emergency cleanup
 */

import { NextRequest, NextResponse } from 'next/server';
import { listContainers, destroyContainer } from '@/app/lib/proxmox';

export async function POST(request: NextRequest) {
  const results: any[] = [];
  
  try {
    const containers = await listContainers();
    
    for (const c of containers) {
      try {
        await destroyContainer(c.vmid);
        results.push({ vmid: c.vmid, name: c.name, status: 'destroyed' });
      } catch (err: any) {
        results.push({ vmid: c.vmid, name: c.name, status: 'failed', error: err.message });
      }
    }

    return NextResponse.json({ 
      message: `Cleaned up ${results.filter(r => r.status === 'destroyed').length}/${containers.length} containers`,
      results 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
