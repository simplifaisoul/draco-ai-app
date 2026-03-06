import { AIProvider, Message, CallOptions } from './types';

export class PollinationsProvider implements AIProvider {
    name = 'Pollinations';
    isAvailable = true;
    priority = 10; // Fallback — only used if Gemini fails

    async call(messages: Message[], options?: CallOptions): Promise<string | ReadableStream> {
        // Pollinations offers a free API — works with or without an API key
        const apiKey = process.env.POLLINATIONS_API_KEY;
        const endpoint = apiKey
            ? 'https://gen.pollinations.ai/v1/chat/completions'
            : 'https://text.pollinations.ai/openai';

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                    model: apiKey ? 'openai' : 'openai',
                    stream: true,
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`Pollinations API error: ${response.status} - ${text}`);
                throw new Error(`Pollinations API error: ${response.status} - ${text}`);
            }

            if (response.body) {
                return response.body;
            }

            throw new Error('No response body from Pollinations');
        } catch (error) {
            console.error('Pollinations call failed:', error);
            throw error;
        }
    }

    async health(): Promise<boolean> {
        return true; // Always available — free API works without key
    }
}
