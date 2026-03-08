import { AIProvider, Message, CallOptions } from './types';

// API key rotation — cycles through available keys on failure
let currentKeyIndex = 0;

// Per-key cooldown tracking: key index -> timestamp when cooldown expires
const keyCooldowns: Map<number, number> = new Map();
const COOLDOWN_MS = 60_000; // 60 seconds cooldown per rate-limited key

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

function isKeyOnCooldown(keyIndex: number): boolean {
    const expiry = keyCooldowns.get(keyIndex);
    if (!expiry) return false;
    if (Date.now() >= expiry) {
        keyCooldowns.delete(keyIndex); // Cooldown expired
        return false;
    }
    return true;
}

function putKeyOnCooldown(keyIndex: number): void {
    keyCooldowns.set(keyIndex, Date.now() + COOLDOWN_MS);
    console.warn(`[Gemini] Key ${keyIndex + 1} placed on ${COOLDOWN_MS / 1000}s cooldown`);
}

function getKeyStatus(apiKeys: string[]): string {
    const statuses = apiKeys.map((_, i) => {
        if (isKeyOnCooldown(i)) {
            const remaining = Math.ceil(((keyCooldowns.get(i) || 0) - Date.now()) / 1000);
            return `Key ${i + 1}: 🔴 cooldown (${remaining}s)`;
        }
        return `Key ${i + 1}: 🟢 available`;
    });
    return statuses.join(' | ');
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
        let skippedCooldown = 0;

        for (let attempt = 0; attempt < apiKeys.length; attempt++) {
            const keyIndex = (currentKeyIndex + attempt) % apiKeys.length;
            const apiKey = apiKeys[keyIndex];

            // Skip keys that are on cooldown
            if (isKeyOnCooldown(keyIndex)) {
                skippedCooldown++;
                console.log(`[Gemini] Skipping key ${keyIndex + 1} (on cooldown)`);
                continue;
            }

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

                    // If rate limited (429) or quota exceeded, put on cooldown and try next key
                    if (response.status === 429 || response.status === 403) {
                        putKeyOnCooldown(keyIndex);
                        rateLimitCount++;
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
                    putKeyOnCooldown(keyIndex);
                    rateLimitCount++;
                }
                // Continue to next key
            }
        }

        // All keys exhausted
        const totalBlocked = rateLimitCount + skippedCooldown;
        console.error(`All Gemini API keys failed. Status: ${getKeyStatus(apiKeys)}`);

        if (totalBlocked >= apiKeys.length && apiKeys.length > 0) {
            // Find earliest cooldown expiry
            let soonest = Infinity;
            keyCooldowns.forEach(expiry => { if (expiry < soonest) soonest = expiry; });
            const waitSecs = Math.max(1, Math.ceil((soonest - Date.now()) / 1000));

            throw new Error(`⚠️ All ${apiKeys.length} API keys are rate-limited. A key frees up in ~${waitSecs}s. Please wait and try again.`);
        }

        throw lastError || new Error('All Gemini API keys exhausted');
    }

    async health(): Promise<boolean> {
        return getApiKeys().length > 0;
    }
}
