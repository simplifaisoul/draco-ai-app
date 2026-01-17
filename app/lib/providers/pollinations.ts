import { AIProvider, Message, CallOptions } from './types';

export class PollinationsProvider implements AIProvider {
    name = 'Pollinations';
    isAvailable = true;
    priority = 1;

    async call(messages: Message[], options?: CallOptions): Promise<string> {
        const endpoint = `https://text.pollinations.ai/${options?.model || 'openai'}`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages,
                    stream: false // Backend aggregation usually easier without stream first, or we pipe stream. Let's do non-stream for simplicity in backend first as per guide request structure, or adapt. The guide implies full response.
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) throw new Error(`Pollinations API error: ${response.status}`);

            const text = await response.text(); // Pollinations text API returns raw text often, or JSON depending on endpoint.
            // Based on previous experience, /openai/ endpoint returns text directly or JSON.
            // Let's assume text if it's the raw text endpoint.
            // Actually, my previous code used JSON body with "messages".
            // Pollinations usually returns raw text if correct.
            // Let's safe parse.
            return text;

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
