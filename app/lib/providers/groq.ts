import { AIProvider, Message, CallOptions } from './types';
import { ENV } from '../env';

export class GroqProvider implements AIProvider {
    name = 'Groq';
    isAvailable = !!ENV.groqApiKey;
    priority = 2;

    async call(messages: Message[], options?: CallOptions): Promise<string | ReadableStream> {
        if (!ENV.groqApiKey) throw new Error('Grok API Key missing');

        // Using xAI (Grok) Endpoint
        const endpoint = 'https://api.x.ai/v1/chat/completions';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ENV.groqApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'grok-2-1212', // Latest Grok Beta
                    messages: messages.map(m => ({ role: m.role, content: m.content })), // Sanitize
                    temperature: 0.7,
                    stream: true, // Enable Streaming
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) throw new Error(`xAI API error: ${response.status}`);

            if (response.body) {
                return response.body;
            }

            // Fallback (shouldn't happen with stream: true usually)
            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('[Grok] Error:', error);
            throw error;
        }
    }

    async health(): Promise<boolean> {
        if (!ENV.groqApiKey) return false;
        try {
            // xAI doesn't have a public free health check easily without auth, but models endpoint works
            const response = await fetch('https://api.x.ai/v1/models', {
                headers: { 'Authorization': `Bearer ${ENV.groqApiKey}` }
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
