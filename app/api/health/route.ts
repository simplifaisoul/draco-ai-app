import { NextResponse } from 'next/server';
import { providerManager } from '@/app/lib/providers/manager';

export async function GET() {
    const health = await providerManager.checkHealth();
    const allHealthy = health.every(p => p.healthy);

    return NextResponse.json({
        status: allHealthy ? 'healthy' : 'degraded',
        providers: health,
        timestamp: new Date().toISOString()
    });
}
