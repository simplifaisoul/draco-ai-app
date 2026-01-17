import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
    count: number;
    timestamp: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 30; // requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute

export function getRateLimitKey(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    return ip;
}

export function checkRateLimit(ip: string): {
    allowed: boolean;
    remaining: number;
    resetIn: number;
    retryAfter?: number;
} {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry) {
        rateLimitMap.set(ip, { count: 1, timestamp: now });
        return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: WINDOW_MS };
    }

    const timePassed = now - entry.timestamp;

    if (timePassed > WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, timestamp: now });
        return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: WINDOW_MS };
    }

    if (entry.count >= RATE_LIMIT) {
        const retryAfter = Math.ceil((WINDOW_MS - timePassed) / 1000);
        return {
            allowed: false,
            remaining: 0,
            resetIn: WINDOW_MS - timePassed,
            retryAfter,
        };
    }

    entry.count++;
    return {
        allowed: true,
        remaining: RATE_LIMIT - entry.count,
        resetIn: WINDOW_MS - timePassed
    };
}

export function applyRateLimitHeaders(
    response: NextResponse,
    rateLimit: ReturnType<typeof checkRateLimit>
): void {
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(Date.now() + rateLimit.resetIn).toISOString());
    if (rateLimit.retryAfter) {
        response.headers.set('Retry-After', rateLimit.retryAfter.toString());
    }
}
