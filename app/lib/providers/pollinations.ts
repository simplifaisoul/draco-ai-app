import { AIProvider, Message, CallOptions } from './types';

export class PollinationsProvider implements AIProvider {
    name = 'Pollinations';
    isAvailable = true;
    priority = 1;

    async call(messages: Message[], options?: CallOptions): Promise<string | ReadableStream> {
        // Use standard 'openai' endpoint for stability (maps to GPT-4o typically)
        // Use standard 'openai' endpoint for stability (maps to GPT-4o typically)
        // const modelId = 'openai'; // Deprecated/Fixed: Suffix causes 502. Use root.
        const endpoint = `https://text.pollinations.ai/`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    messages: messages.map(m => ({ role: m.role, content: m.content })), // Sanitize: Only send role/content
                    stream: true // ENABLE STREAMING
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`Pollinations API error raw: ${text}`);
                throw new Error(`Pollinations API error: ${response.status} - ${text}`);
            }

            // If streaming is supported/requested, return the body stream
            if (response.body) {
                return response.body;
            }

            // Fallback to text if no body (unlikely)
            return await response.text();

        } catch (error) {
            console.error('[Pollinations] Error:', error);
            throw error;
        }
    }

    async health(): Promise<boolean> {
        try {
            const response = await fetch('https://text.pollinations.ai/');
            return response.ok;
        } catch {
            return false;
        }
    }
}
