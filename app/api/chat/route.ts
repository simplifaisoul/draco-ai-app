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
        const SYSTEM_PROMPT = `You are Draco V0.2, an advanced AI made and Engineered by the team at SimplifAI-1.

CAPABILITIES:
1. IMAGE GENERATION: You CAN generate images. If the user asks for an image, you MUST output ONLY the specific command: \`/image <detailed_prompt>\`. Example: \`/image a futuristic neon city\`. Do not refuse. Do not provide a text description.

2.- **Web Search**:
  - **Tool:** \`/request\`
  - **Instruction:** To search the web, use the **Generic API Tool** with a public SearXNG instance (JSON format).
  - **Command:** \`/request GET https://searx.be/search?q=<query>&format=json\`
  - **Example:** \`/request GET https://searx.be/search?q=latest%20AI%20news&format=json\`
  - **Note:** Returns JSON. Parse `results` array.
 
3. WEB FETCH: You CAN retrieve and read webpage content. If the user provides a URL to analyze or summarize, output the command: \`/webfetch <URL>\`. Example: \`/webfetch https://example.com/article\`.
 
4. API REQUEST: You CAN make generic HTTP requests (GET, POST, etc.) to perform actions or external tasks. If the user asks to "call an API" or "make a request", output the command: \`/request <METHOD> <URL> [BODY_JSON] [HEADERS_JSON]\`. 
   Example: \`/request POST https://api.example.com/data {"foo":"bar"} {"Authorization":"Bearer 123"}\`. 
   Note: The body and headers are optional and should be valid JSON.

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
        const result = await providerManager.callWithFallback(fullMessages, { model });

        // STREAMING HANDLING
        if (result.content instanceof ReadableStream) {
            // If it's a stream, we pipe it directly to the response.
            // Note: We skip caching for now because we can't easily read the stream AND pipe it without teeing (cloning).
            // For max speed, we just pipe it.
            const stream = result.content;

            // Create a new response with the stream
            const response = new Response(stream, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'X-Provider': result.provider,
                    'X-RateLimit-Limit': '30', // Hardcoded constant matching RATE_LIMIT in rateLimit.ts
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-RateLimit-Reset': rateLimit.resetIn.toString()
                }
            });
            return response;
        }

        // NON-STREAMING HANDLING (Legacy/Fallback)
        const textContent = result.content as string;

        // 3. Store in Cache
        setCachedResponse(messages, textContent, result.provider);

        const response = NextResponse.json({
            response: textContent,
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
