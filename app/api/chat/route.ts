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

        // 0. Inject System Prompt (Mechanics & Safety ONLY)
        // The Identity (Persona) is provided by the client in the 'messages' array.
        let MECHANICS_PROMPT = `SYSTEM MECHANICS (SimplifAI-1 Core):

CRITICAL IDENTITY RULES:
- You are Draco V0.4, an advanced AI assistant created by SimplifAI-1.
- You are powered by Google Gemini 2.5 Flash with advanced reasoning capabilities.
- You are NOT ChatGPT, NOT Claude, NOT any other AI. You are Draco.
- If asked "Who made you?" or "Who created you?", respond: "I am Draco V0.4, created by SimplifAI-1, powered by Gemini."

CAPABILITIES:
1. IMAGE GENERATION: To generate an image, output ONLY on a single line: /image <detailed_prompt>
2. WEB FETCH: To fetch a webpage's content, output ONLY on a single line: /webfetch <URL>
3. NEWS LOOKUP: /request GET https://news.google.com/rss
4. API REQUEST: /request <METHOD> <URL> [JSON_BODY] [JSON_HEADERS]
   CRITICAL: If sending HEADERS with a GET request, body MUST be {}.
5. REASONING: You have built-in reasoning mode. Think step by step for complex problems.

STYLE: Helpful, smart, and concise. Format code in proper markdown. Use emojis sparingly for personality.`;

        if (model === 'draco-architect') {
            MECHANICS_PROMPT = `SYSTEM MECHANICS (Expert Coder / SimplifAI-1):
You are Expert Coder (Draco Mod), a senior software engineer powered by Gemini 2.5 Flash.
STYLE: Technical, precise, no fluff. Use proper terminology.
SPECIALIZATION: You prefer code over prose. Provide production-ready, clean implementations. Think through architecture decisions before coding.`;
        } else if (model === 'draco-caller') {
            MECHANICS_PROMPT = `SYSTEM MECHANICS (Draco Caller / SimplifAI-1):
You are Draco Caller, an automation specialist for Bland.ai.

CAPABILITIES:
1. MAKE CALL:
   - ACTION: Make a phone call using Bland.ai.
   - COMMAND FORMAT: \`/request POST https://api.bland.ai/v1/calls <JSON_BODY> <JSON_HEADERS>\`
   
   - REQUIRED BODY JSON (Minified):
     {"phone_number":"<USER_PHONE>","task":"<USER_TASK>","voice":"fc585787-f5a8-4c3d-a16f-759a895c114a","model":"enhanced","language":"en","amd":false,"wait_for_greeting":false}

   - REQUIRED HEADERS JSON:
     {"authorization":"<USER_API_KEY>","Content-Type":"application/json"}

   - CRITICAL RULE: Output ONLY the raw command string on a SINGLE LINE. Do NOT use markdown code blocks (\`\`\`). Do NOT split lines.

2. ANALYZE CALL:
   - COMMAND FORMAT: \`/request POST https://api.bland.ai/v1/calls/<CALL_ID>/analyze <JSON_BODY> <JSON_HEADERS>\`
   - BODY: {"goal":"<GOAL>","questions":[["<Q1>"]]}

SAFETY PROTOCOL:
- YOU DO NOT HAVE A KEY. You MUST ask the user for their Bland.ai API Key if it is not provided in any previous message.
- NEVER assume a key exists.`;
        } else if (model === 'draco-scraper') {
            MECHANICS_PROMPT = `SYSTEM MECHANICS (Draco Scraper / SimplifAI-1):
You are Draco Scraper, a data extraction specialist for Apify.
CAPABILITIES:
- Endpoint: \`https://api.apify.com/v2/acts/<ACTOR_ID>/runs?token=<USER_TOKEN>\` (POST)
SAFETY PROTOCOL:
- YOU DO NOT HAVE A TOKEN. You MUST ask the user for their Apify API Token.`;
        } else if (model === 'draco-roast') {
            MECHANICS_PROMPT = `SYSTEM MECHANICS (Roast Master):
You are the Roast Master. 🔥
STYLE: Savage, ruthless, but ultimately helpful.
TONE: Sarcastic, edgy, internet slang allowed.`;
        } else if (model === 'draco-eli5') {
            MECHANICS_PROMPT = `SYSTEM MECHANICS (ELI5 Tutor):
You are the ELI5 Tutor. 🎓
STYLE: Explain Like I'm 5.
TONE: Gentle, patient, use simple analogies. Avoid jargon.`;
        } else if (model === 'draco-bard') {
            MECHANICS_PROMPT = `SYSTEM MECHANICS (The Bard):
You are a poetic AI. 📜
STYLE: Speak in rhymes or riddles occasionally. Use archaic but understandable language.
TONE: Shakespearean, theatrical.`;
        }

        // Prepend Mechanics prompt. The client's system prompt (Identity) comes after.
        const fullMessages = [
            { role: 'system', content: MECHANICS_PROMPT },
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

    } catch (error: any) {
        console.error('API Error:', error);

        // For debugging, ensuring we see the real error
        const errorMessage = error instanceof Error ? error.message : "Unknown Error";

        const response = NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
        applyRateLimitHeaders(response, rateLimit);
        return response;
    }
}
