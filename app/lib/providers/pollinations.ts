import { AIProvider, Message, CallOptions } from './types';

export class PollinationsProvider implements AIProvider {
    name = 'Pollinations';
    isAvailable = true;
    priority = 1;

    async call(messages: Message[], options?: CallOptions): Promise<string> {
        // Use standard 'openai' endpoint which is most stable, or user selection if valid
        const modelId = options?.model === 'openai' ? 'openai' : (options?.model || 'openai');
        const endpoint = `https://text.pollinations.ai/${modelId}`;

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

            const text = await response.text();

            try {
                // Attempt to parse JSON envelope if present
                const json = JSON.parse(text);

                if (json && typeof json === 'object') {
                    // Check common fields
                    if (json.content) return json.content;
                    if (json.response) return json.response;
                    if (json.choices?.[0]?.message?.content) return json.choices[0].message.content;

                    // Specific handling for reasoning models (DeepSeek/R1 variants) that might time out
                    if (json.choices?.[0]?.message?.reasoning_content && !json.choices?.[0]?.message?.content) {
                        // If we have reasoning but no content, it likely timed out or is being verbose.
                        // We can't use reasoning as the answer usually.
                        console.warn('[Pollinations] Received reasoning but no content (truncated?).');
                        return "⚠️ The model thought for too long and didn't provide an answer. Please try again or use a different model.";
                    }

                    // If we parsed JSON but found no known content field, DO NOT return raw text (which is the JSON).
                    // This fixes the bug where users see {"id": ...}
                    console.error('[Pollinations] Unknown JSON structure:', text.substring(0, 100));
                    return "⚠️ Received an empty or invalid response from the AI provider.";
                }

                return text; // JSON valid but not an envelope we know? Return text just in case.
            } catch {
                return text; // Not JSON, return raw text
            }

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
