import { AIProvider, Message, CallOptions } from './types';

// API key rotation — cycles through available keys on failure
let currentKeyIndex = 0;

function getApiKeys(): string[] {
    const keys: string[] = [];

    // Primary key
    if (process.env.GEMINI_API_KEY) {
        keys.push(process.env.GEMINI_API_KEY);
    }

    // Backup keys (comma-separated)
    if (process.env.GEMINI_API_KEYS_BACKUP) {
        const backups = process.env.GEMINI_API_KEYS_BACKUP.split(',').map(k => k.trim()).filter(Boolean);
        keys.push(...backups);
    }

    return keys;
}

export class GeminiProvider implements AIProvider {
    name = 'Gemini';
    isAvailable = true;
    priority = 1;

    async call(messages: Message[], options?: CallOptions): Promise<string | ReadableStream> {
        const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        const apiKeys = getApiKeys();

        if (apiKeys.length === 0) {
            throw new Error('No Gemini API keys configured. Set GEMINI_API_KEY and/or GEMINI_API_KEYS_BACKUP.');
        }

        // Try each key, starting from where we left off
        let lastError: Error | null = null;
        let rateLimitCount = 0;

        for (let attempt = 0; attempt < apiKeys.length; attempt++) {
            const keyIndex = (currentKeyIndex + attempt) % apiKeys.length;
            const apiKey = apiKeys[keyIndex];

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        messages: messages.map(m => ({ role: m.role, content: m.content })),
                        model: 'gemini-2.5-flash',
                        stream: true,
                        reasoning_effort: 'low',
                    }),
                    signal: AbortSignal.timeout(120000),
                });

                if (!response.ok) {
                    const text = await response.text();
                    console.error(`Gemini key ${keyIndex + 1}/${apiKeys.length} failed: ${response.status} - ${text}`);

                    // If rate limited (429) or quota exceeded, try next key
                    if (response.status === 429 || response.status === 403) {
                        lastError = new Error(`Key ${keyIndex + 1} rate limited/blocked: ${response.status}`);
                        continue; // Try next key
                    }

                    throw new Error(`Gemini API error: ${response.status} - ${text}`);
                }

                // Success! Rotate to next key for next request (load balancing)
                currentKeyIndex = (keyIndex + 1) % apiKeys.length;

                if (response.body) {
                    return response.body;
                }

                throw new Error('No response body from Gemini');
            } catch (error: any) {
                lastError = error as Error;
                console.warn(`Gemini key ${keyIndex + 1}/${apiKeys.length} failed:`, error);

                if (error.message && (error.message.includes('429') || error.message.includes('403'))) {
                    rateLimitCount++;
                }
                // Continue to next key
            }
        }

        // All keys exhausted
        console.error('All Gemini API keys failed:', lastError);

        if (rateLimitCount === apiKeys.length && apiKeys.length > 0) {
            throw new Error(`⚠️ All ${apiKeys.length} Gemini API keys are currently rate-limited (too many requests). Please wait 1 minute before trying again.`);
        }

        throw lastError || new Error('All Gemini API keys exhausted');
    }

    async health(): Promise<boolean> {
        return getApiKeys().length > 0;
    }
}
