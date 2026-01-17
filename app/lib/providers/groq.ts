import { AIProvider, Message, CallOptions } from './types';
import { ENV } from '../env';

export class GroqProvider implements AIProvider {
    name = 'Groq';
    isAvailable = !!ENV.groqApiKey;
    priority = 2;

    async call(messages: Message[], options?: CallOptions): Promise<string> {
        if (!ENV.groqApiKey) throw new Error('Groq Key missing');

        const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ENV.groqApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-70b-versatile',
                    messages: messages,
                    temperature: 0.7,
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) throw new Error(`Groq API error: ${response.status}`);

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('[Groq] Error:', error);
            throw error;
        }
    }

    async health(): Promise<boolean> {
        if (!ENV.groqApiKey) return false;
        try {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${ENV.groqApiKey}` }
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
