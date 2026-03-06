import { AIProvider, Message, CallOptions } from './types';

// HuggingFace Inference API — free for many models, no key required for some
// Falls back to this when Gemini keys are all rate-limited
export class HuggingFaceProvider implements AIProvider {
    name = 'HuggingFace';
    isAvailable = true;
    priority = 5; // Fallback after Gemini

    async call(messages: Message[], options?: CallOptions): Promise<string | ReadableStream> {
        // Use the free HuggingFace Inference API with Qwen model (good, free, fast)
        const hfToken = process.env.HF_TOKEN || '';
        const model = 'Qwen/Qwen2.5-72B-Instruct';
        const endpoint = `https://router.huggingface.co/novita/v3/openai/chat/completions`;

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (hfToken) {
                headers['Authorization'] = `Bearer ${hfToken}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                    model: model,
                    stream: true,
                    max_tokens: 2048,
                }),
                signal: AbortSignal.timeout(60000),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`HuggingFace API error: ${response.status} - ${text}`);
                throw new Error(`HuggingFace API error: ${response.status} - ${text.substring(0, 200)}`);
            }

            if (response.body) {
                return response.body;
            }

            throw new Error('No response body from HuggingFace');
        } catch (error) {
            console.error('HuggingFace call failed:', error);
            throw error;
        }
    }

    async health(): Promise<boolean> {
        return true; // Free API, always available
    }
}
