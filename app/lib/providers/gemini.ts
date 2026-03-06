import { AIProvider, Message, CallOptions } from './types';

export class GeminiProvider implements AIProvider {
    name = 'Gemini';
    isAvailable = true;
    priority = 1;

    async call(messages: Message[], options?: CallOptions): Promise<string | ReadableStream> {
        const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required. Get a free key at https://aistudio.google.com/apikey');
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
                    // Enable Gemini's native thinking/reasoning for better quality
                    reasoning_effort: 'low',
                }),
                signal: AbortSignal.timeout(120000), // 120s — Gemini thinking can take longer
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`Gemini API error: ${response.status} - ${text}`);
                throw new Error(`Gemini API error: ${response.status} - ${text}`);
            }

            if (response.body) {
                return response.body;
            }

            throw new Error('No response body from Gemini');
        } catch (error) {
            console.error('Gemini call failed:', error);
            throw error;
        }
    }

    async health(): Promise<boolean> {
        return !!process.env.GEMINI_API_KEY;
    }
}
