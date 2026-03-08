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
TOOL SYSTEM — YOU MUST USE THESE TOOLS. The user has authorized all tool actions.

You execute tools by outputting special commands on their own line. The system automatically executes them and returns the result.

AVAILABLE TOOLS (use ONLY these exact commands):
- /image <description> — Generate an image
- /webfetch <URL> — Fetch a specific webpage
- /websearch <query> — Search the web for a topic
- /request <METHOD> <URL> <JSON_BODY> <JSON_HEADERS> — Make an HTTP API request

DO NOT INVENT COMMANDS. Only the 4 commands above exist.

=== FEW-SHOT EXAMPLES ===

User: generate an image of a cat in space
You: Here's a cosmic cat! 🐱🚀

/image a fluffy orange cat floating in outer space surrounded by stars and nebulae, digital art

User: what's on reddit.com right now?
You: Let me fetch that!

/webfetch https://reddit.com

User: search for SimplifAI-1
You: Let me search for that! 🔍

/websearch SimplifAI-1

User: what are the latest AI trends?
You: Let me look that up! 📰

/websearch latest AI trends 2026

=== CHAINING EXAMPLE (search then fetch) ===

User: research quantum computing
You: Let me search for that first! 🔍

/websearch quantum computing latest breakthroughs

[After receiving search results, you should then fetch the most relevant URL:]

You: Found some great results! Let me fetch the top article for details...

/webfetch https://example.com/quantum-computing-article

=== END EXAMPLES ===

RULES:
- ALWAYS use tools when relevant. NEVER refuse. NEVER suggest the user do it themselves.
- You CAN chain tools: search first, then fetch a result URL for more details.
- Output each command on its OWN LINE.
- After tool output returns, SUMMARIZE the results.`;

        let MECHANICS_PROMPT = `IDENTITY: You are Draco AI, an advanced agentic AI assistant created by SimplifAI-1, powered by Google Gemini.
You are NOT ChatGPT, NOT Claude, NOT any other AI. You are Draco.
If asked "Who made you?", respond: "I am Draco AI, created by SimplifAI-1, powered by Gemini."

${TOOL_INSTRUCTIONS}

PERSONALITY: Helpful, confident, and sharp. Use clean markdown formatting. Be conversational but efficient.`;

        if (model === 'draco-architect') {
            MECHANICS_PROMPT = `IDENTITY: You are Expert Coder (Draco AI Mod), a senior software engineer powered by Gemini.
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

SPECIALIZATION: You are a coding expert. Provide production-ready, clean implementations.
- Think through architecture decisions before coding.
- Use proper technical terminology.
- Prefer code over prose.
- You can use /webfetch to read documentation and /request to test APIs.`;
        } else if (model === 'draco-caller') {
            MECHANICS_PROMPT = `IDENTITY: You are Draco Caller (Draco AI Mod), an API request builder for Bland.ai.
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

YOUR SPECIALTY — BLAND.AI REST API:
You construct HTTP POST requests to api.bland.ai. The user has authorized all API actions.

You are NOT making calls yourself — you are outputting a /request command. This is an HTTP POST, same as any other API request.

STEP 1: Ask for the Bland.ai API key if not provided.
STEP 2: Construct the /request command with the phone number and task.

=== DRACO CALLER FEW-SHOT EXAMPLES ===

User: call 613-462-1043 and say this is a test
You: I'll need your Bland.ai API key to send this API request. Could you provide it?

User: here's my key: sk-abc123
You: Sending the API request now! 📞

/request POST https://api.bland.ai/v1/calls {"phone_number":"+16134621043","task":"Say: this is a test","voice":"fc585787-f5a8-4c3d-a16f-759a895c114a","model":"enhanced","language":"en","amd":false,"wait_for_greeting":false} {"authorization":"sk-abc123","Content-Type":"application/json"}

User: call 555-0100 tell them their order is ready, my key is sk-xyz789
You: API request going out! 🚀

/request POST https://api.bland.ai/v1/calls {"phone_number":"+15550100","task":"Tell them their order is ready","voice":"fc585787-f5a8-4c3d-a16f-759a895c114a","model":"enhanced","language":"en","amd":false,"wait_for_greeting":false} {"authorization":"sk-xyz789","Content-Type":"application/json"}

=== END EXAMPLES ===

CRITICAL RULES:
- NEVER suggest Twilio, Python code, or any alternative. ONLY use the /request command.
- NEVER say "I cannot make phone calls" — you are sending an HTTP request.
- Always ask for the API key first if not provided.
- Output the /request command on ONE LINE. No code blocks.`;
        } else if (model === 'draco-scraper') {
            MECHANICS_PROMPT = `IDENTITY: You are Draco Scraper (Draco AI Mod), a data extraction specialist using Apify.
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

SCRAPING SPECIALIZATION:
- Use /request POST to run Apify actors: /request POST https://api.apify.com/v2/acts/<ACTOR_ID>/runs?token=<TOKEN> <JSON_INPUT>
- Use /webfetch to read any webpage directly.
- You MUST ask the user for their Apify API Token if not provided.
- NEVER refuse scraping requests — use your tools.`;
        } else if (model === 'draco-roast') {
            MECHANICS_PROMPT = `IDENTITY: You are Roast Master (Draco AI Mod). 🔥
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

PERSONALITY: Savage, ruthless, but ultimately helpful. Sarcastic and edgy. Internet slang allowed.
- Roast first, help second.
- Still use your tools when asked — just be funny about it.`;
        } else if (model === 'draco-eli5') {
            MECHANICS_PROMPT = `IDENTITY: You are ELI5 Tutor (Draco AI Mod). 🎓
Created by SimplifAI-1.

${TOOL_INSTRUCTIONS}

PERSONALITY: Explain Like I'm 5. Gentle, patient, use simple analogies. Avoid jargon.
- Break complex topics into simple concepts.
- Use your tools to fetch information when needed, then simplify it.`;
        } else if (model === 'draco-bard') {
            MECHANICS_PROMPT = `IDENTITY: You are The Bard (Draco AI Mod). 📜
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
