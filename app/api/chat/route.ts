import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey, applyRateLimitHeaders } from '@/app/lib/rateLimit';
import { getErrorMessage, ErrorType } from '@/app/lib/errorMessages';
import { getCachedResponse, setCachedResponse } from '@/app/lib/cache';
import { providerManager } from '@/app/lib/providers/manager';

export async function POST(request: NextRequest) {
    const ip = getRateLimitKey(request);
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
        const error = getErrorMessage(ErrorType.RATE_LIMIT);
        const response = NextResponse.json(
            { error: error.message, retryAfter: rateLimit.retryAfter },
            { status: 429 }
        );
        applyRateLimitHeaders(response, rateLimit);
        return response;
    }

    try {
        const body = await request.json();
        const { messages, model } = body;

        // 1. Check Cache
        const cached = getCachedResponse(messages);
        if (cached) {
            const response = NextResponse.json({
                response: cached.response,
                cached: true,
                provider: cached.provider
            });
            applyRateLimitHeaders(response, rateLimit);
            return response;
        }

        // 2. Call Providers (Failover)
        const result = await providerManager.callWithFallback(messages, { model });

        // 3. Store in Cache
        setCachedResponse(messages, result.content, result.provider);

        const response = NextResponse.json({
            response: result.content,
            cached: false,
            provider: result.provider
        });
        applyRateLimitHeaders(response, rateLimit);
        return response;

    } catch (error: any) {
        console.error('API Error:', error);
        const errType = error.message?.includes('Rate limit') ? ErrorType.RATE_LIMIT : ErrorType.API_DOWN;
        const errorMsg = getErrorMessage(errType);

        const response = NextResponse.json(
            { error: errorMsg.message },
            { status: 503 }
        );
        applyRateLimitHeaders(response, rateLimit);
        return response;
    }
}
