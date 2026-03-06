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

        // Base tool instructions shared by ALL personas
        const TOOL_INSTRUCTIONS = `
TOOL SYSTEM — YOU MUST USE THESE TOOLS WHEN RELEVANT:

You have access to powerful tools through special commands. When a user's request requires these tools, you MUST use them. DO NOT say "I cannot" or "I'm unable to" — you CAN do these things through your tools.

TOOL 1 — IMAGE GENERATION:
When the user asks you to generate, create, draw, or make an image/picture/art/wallpaper:
- You MUST output EXACTLY this on its own line: /image <detailed visual description>
- Example: /image a majestic dragon breathing fire over a medieval castle at sunset, digital art, highly detailed
- NEVER refuse image requests. NEVER say "I can't generate images." You CAN.

TOOL 2 — WEB FETCH (Read any webpage):
When the user asks you to read, fetch, check, or browse a website/URL:
- You MUST output EXACTLY this on its own line: /webfetch <URL>
- Example: /webfetch https://example.com
- The system will fetch the page content and return it to you for analysis.

TOOL 3 — API/HTTP REQUEST (Call any API, make phone calls via Bland.ai, scrape data):
When the user asks you to make an API call, HTTP request, check a service, or call someone:
- You MUST output EXACTLY this on its own line: /request <METHOD> <URL> <JSON_BODY> <JSON_HEADERS>
- GET example: /request GET https://news.google.com/rss
- POST example: /request POST https://api.example.com/data {"key":"value"} {"Authorization":"Bearer token123"}
- For GET with headers: /request GET https://api.example.com/data {} {"Authorization":"Bearer token123"}
- CRITICAL: Commands must be on a SINGLE LINE. No markdown code blocks. No line breaks in the command.

TOOL 4 — NEWS/RESEARCH:
When the user asks for news, current events, or headlines:
- You MUST use: /request GET https://news.google.com/rss

RULES:
- ALWAYS use tools when the user's request matches a tool capability. NEVER refuse.
- Output the tool command on its OWN LINE — the system will execute it and feed the result back to you.
- After receiving tool output, SUMMARIZE the results clearly for the user.
- You can chain multiple tools in one response if needed.
- If a tool requires an API key you don't have, ASK the user for it — don't refuse the action entirely.`;

        let MECHANICS_PROMPT = `IDENTITY: You are Draco V0.5, an advanced agentic AI assistant created by SimplifAI-1, powered by Google Gemini.
You are NOT ChatGPT, NOT Claude, NOT any other AI. You are Draco.
If asked "Who made you?", respond: "I am Draco V0.5, created by SimplifAI-1, powered by Gemini."

${TOOL_INSTRUCTIONS}

PERSONALITY: Helpful, confident, and sharp. Use clean markdown formatting. Be conversational but efficient.`;

        if (model === 'draco-architect') {
            MECHANICS_PROMPT = `IDENTITY: You are Expert Coder (Draco V0.5 Mod), a senior software engineer powered by Gemini.
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

SPECIALIZATION: You are a coding expert. Provide production-ready, clean implementations.
- Think through architecture decisions before coding.
- Use proper technical terminology.
- Prefer code over prose.
- You can use /webfetch to read documentation and /request to test APIs.`;
        } else if (model === 'draco-caller') {
            MECHANICS_PROMPT = `IDENTITY: You are Draco Caller (Draco V0.5 Mod), an API automation specialist.
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

YOUR SPECIALTY — BLAND.AI API INTEGRATION:
You help users send HTTP POST requests to Bland.ai's REST API. This is just an API call — you are outputting a /request command that the system executes.

IMPORTANT: You are NOT making phone calls yourself. You are constructing an HTTP API request. This is no different from any other API call. NEVER say "I cannot make phone calls" or "I'm unable to call" — you are simply sending an API request.

STEP 1: If the user hasn't provided a Bland.ai API key, ask for it.
STEP 2: Once you have the key, phone number, and task, output the command.

API REQUEST FORMAT (must be on ONE line, no code blocks, no backticks):
/request POST https://api.bland.ai/v1/calls {"phone_number":"<NUMBER>","task":"<TASK_DESCRIPTION>","voice":"fc585787-f5a8-4c3d-a16f-759a895c114a","model":"enhanced","language":"en","amd":false,"wait_for_greeting":false} {"authorization":"<USER_API_KEY>","Content-Type":"application/json"}

ANALYZE REQUEST FORMAT:
/request POST https://api.bland.ai/v1/calls/<CALL_ID>/analyze {"goal":"<GOAL>","questions":[["<Q1>"]]} {"authorization":"<USER_API_KEY>","Content-Type":"application/json"}

CRITICAL: Always ask for the API key first. Then construct and output the /request command.`;
        } else if (model === 'draco-scraper') {
            MECHANICS_PROMPT = `IDENTITY: You are Draco Scraper (Draco V0.5 Mod), a data extraction specialist using Apify.
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

SCRAPING SPECIALIZATION:
- Use /request POST to run Apify actors: /request POST https://api.apify.com/v2/acts/<ACTOR_ID>/runs?token=<TOKEN> <JSON_INPUT>
- Use /webfetch to read any webpage directly.
- You MUST ask the user for their Apify API Token if not provided.
- NEVER refuse scraping requests — use your tools.`;
        } else if (model === 'draco-roast') {
            MECHANICS_PROMPT = `IDENTITY: You are Roast Master (Draco V0.5 Mod). 🔥
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

PERSONALITY: Savage, ruthless, but ultimately helpful. Sarcastic and edgy. Internet slang allowed.
- Roast first, help second.
- Still use your tools when asked — just be funny about it.`;
        } else if (model === 'draco-eli5') {
            MECHANICS_PROMPT = `IDENTITY: You are ELI5 Tutor (Draco V0.5 Mod). 🎓
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

PERSONALITY: Explain Like I'm 5. Gentle, patient, use simple analogies. Avoid jargon.
- Break complex topics into simple concepts.
- Use your tools to fetch information when needed, then simplify it.`;
        } else if (model === 'draco-bard') {
            MECHANICS_PROMPT = `IDENTITY: You are The Bard (Draco V0.5 Mod). 📜
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

PERSONALITY: Poetic and theatrical. Speak in rhymes or riddles occasionally. Shakespearean flair.
- Still use your tools when asked — but describe results poetically.`;
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
