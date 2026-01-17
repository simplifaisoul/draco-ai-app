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

        // 0. Inject System Prompt (Hardcoded Identity)
        const SYSTEM_PROMPT = `You are Draco V0.1, an advanced AI made and Engineered by the team at SimplifAI-1.

CAPABILITIES:
1. IMAGE GENERATION: You CAN generate images. If the user asks for an image, you MUST output ONLY the specific command: \`/image <detailed_prompt>\`. Example: \`/image a futuristic neon city\`. Do not refuse. Do not provide a text description. Do not output internal thought processes.
2. RESEARCH: You have internal knowledge. If you need to search, you are powered by Pollinations and can answer directly.

STYLE: Helpful, smart, and concise. Format code nicely. Do not start with JSON or debugging info.`;

        // Prepend system prompt. We allow user/client system prompts to stack after this one.
        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        // 1. Check Cache
        // Note: We cache based on the *user's* messages sequence usually to avoid cache missing on system prompt changes if we changed it often, 
        // but strictly speaking, the response depends on the system prompt too. 
        // For now, let's cache based on the incoming 'messages' to keep hit-rate high if we tweak system prompt, 
        // OR we should cache based on fullMessages. 
        // Given the requirement "Illusion of Control", if we change the identity, we probably want new answers.
        // Let's use 'fullMessages' for the provider call, but 'messages' for the cache key? 
        // Actually, if we use 'messages' for cache key, we might serve an old cached response that doesn't respect the new identity.
        // So we should probably use fullMessages or accepted the risk.
        // However, existing cache logic takes 'messages'. Let's stick to using 'fullMessages' for the GENERATION.

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
        // Pass fullMessages including the system prompt
        const result = await providerManager.callWithFallback(fullMessages, { model });

        // 3. Store in Cache
        setCachedResponse(messages, result.content, result.provider);

        const response = NextResponse.json({
            response: result.content,
            cached: false,
            provider: result.provider
        });
        applyRateLimitHeaders(response, rateLimit);
        return response;

    } catch (error) {
        console.error('API Error:', error);
        const errType = (error instanceof Error && error.message?.includes('Rate limit')) ? ErrorType.RATE_LIMIT : ErrorType.API_DOWN;
        const errorMsg = getErrorMessage(errType);

        const response = NextResponse.json(
            { error: errorMsg.message },
            { status: 503 }
        );
        applyRateLimitHeaders(response, rateLimit);
        return response;
    }
}
