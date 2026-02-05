const { messages } = body; // Simplified destructure, model not needed if hardcoded logic is removed or simplified. Or keep model if used for other provider logic. 
// Actually, looking at the code, 'model' is used for conditional prompts.
// But the user wants ONLY Pollinations. Pollinations handles "openai" model ID usually.
// Let's keep 'model' for now to support the other personas (Draco Caller etc) but remove Groq specific bits if any exist. 
// Checking the file content... There is NO specific block for model === 'grok-2' in the MECHANICS_PROMPT section I viewed. 
// It seems 'grok-2' was only used in the GroqProvider implementation which I deleted.
// Wait, looking at the previous file view of route.ts...
// Lines 43-47: model === 'draco-architect'
// ...
// There is no explicit 'grok' check in the mechanics prompt. 
// However, I should make sure the valid models list in `page.tsx` reflects this change eventually, but for now I am focusing on the backend.
// The backend `route.ts` seems fine as is regarding the `MECHANICS_PROMPT`.
// I will just leave it if there's no direct reference to 'grok' or 'xai'.

// Wait, I should verify if I need to change the default model in `page.tsx`.
// The user said "use pollination remove groq".
// Pollinations supports 'openai' model ID.
// GroqProvider used 'grok-2-1212'.
// If the frontend sends 'grok-2', Pollinations might ignore it or fail if it expects 'openai'.
// But `PollinationsProvider` (which I edited) hardcodes `const modelId = 'openai';` on line 10.
// So whatever the frontend sends, PollinationsProvider sends 'openai' to the Pollinations API.
// So `route.ts` logic for `MECHANICS_PROMPT` customization based on `model` (architect, caller, etc) is still valid for personas.

// So actually, `route.ts` might not need changes if it doesn't reference Groq explicitly.
// Scanning `route.ts`...
// It imports `GroqProvider`? No, that was `manager.ts`.
// `route.ts` imports `providerManager`.
// So `route.ts` is likely clean.

// I will double check the `page.tsx` default model though.
// `page.tsx` has `const [currentModel, setCurrentModel] = useState("draco-prime");`.
// `draco-prime` likely maps to... well, `manager.ts` receives the model.
// `PollinationsProvider` hardcodes 'openai'. 
// So the `model` param passed to `callWithFallback` is effectively ignored by `PollinationsProvider` implementation.
// This is fine.

// One thing: The `route.ts` had a comment: 
// "let MECHANICS_PROMPT = ... CRITICAL IDENTITY RULES ... - You are NOT an OpenAI model."
// Pollinations uses OpenAI models behind the scenes often.
// So the identity prompt is accurate enough ("Created by SimplifAI-1").

// I will skip editing `route.ts` if it has no Groq imports.
// Let me re-read the import section of `route.ts` just to be super safe.
// Line 5: `import { providerManager } from '@/app/lib/providers/manager';`
// No direct Groq import.

// So the task is just to verify and push.
// I'll update `task.md` instead.

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
- You are Draco V0.4, created by SimplifAI-1.
- You are NOT an OpenAI model.
- You are NOT ChatGPT.
- You were NOT developed by OpenAI.
- If asked "Who made you?" or "Who created you?", you MUST respond: "I am Draco V0.4, created by SimplifAI-1."

CAPABILITIES:
1. IMAGE GENERATION: Output ONLY: \`/image <detailed_prompt>\`.
2. WEB FETCH: Output ONLY: \`/webfetch <URL>\`.
3. NEWS LOOKUP: \`/request GET https://news.google.com/rss\`
4. API REQUEST: \`/request <METHOD> <URL> [BODY] [HEADERS]\`.
   CRITICAL: If sending HEADERS with a GET request, body MUST be \`{}\`.`;

        if (model === 'draco-architect') {
            MECHANICS_PROMPT = `SYSTEM MECHANICS (Expert Coder / SimplifAI-1):
You are Expert Coder (Draco Mod), a senior software engineer.
STYLE: Technical, precise, no fluff. Use proper terminology.
SPECIALIZATION: You prefer code over prose. Provide production-ready, clean implementations.`;
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
