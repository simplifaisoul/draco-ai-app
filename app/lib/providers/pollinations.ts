import { AIProvider, Message, CallOptions } from './types';

export class PollinationsProvider implements AIProvider {
    name = 'Pollinations';
    isAvailable = true;
    priority = 10; // Fallback — only used if Gemini fails

    async call(messages: Message[], options?: CallOptions): Promise<string | ReadableStream> {
        // Use the new authenticated gen.pollinations.ai endpoint
        const endpoint = `https://gen.pollinations.ai/v1/chat/completions`;
        const apiKey = process.env.POLLINATIONS_API_KEY;

        if (!apiKey) {
            throw new Error('POLLINATIONS_API_KEY environment variable is required. Get your key at https://enter.pollinations.ai');
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    messages: messages.map(m => ({ role: m.role, content: m.content })), // Sanitize: Only send role/content
                    model: 'openai', // Default model
                    stream: true // ENABLE STREAMING
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`Pollinations API error: ${response.status} - ${text}`);
                throw new Error(`Pollinations API error: ${response.status} - ${text}`);
            }

            // Return the stream directly
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
        // Simple check - if API key exists, assume healthy
        return !!process.env.POLLINATIONS_API_KEY;
    }
}
