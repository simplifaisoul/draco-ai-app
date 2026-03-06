import { GeminiProvider } from './gemini';
import { HuggingFaceProvider } from './huggingface';
import { Message, CallOptions, ProviderResponse, AIProvider } from './types';

export class ProviderManager {
    private providers: AIProvider[];

    constructor() {
        this.providers = [
            new GeminiProvider(),         // Primary — priority 1
            new HuggingFaceProvider(),    // Fallback — priority 5
        ].sort((a, b) => a.priority - b.priority);
    }

    async callWithFallback(messages: Message[], options?: CallOptions): Promise<ProviderResponse> {
        let lastError: Error | null = null;
        const errors: string[] = [];

        for (const provider of this.providers) {
            if (!provider.isAvailable) continue;

            try {
                console.log(`[Manager] Trying ${provider.name}...`);
                const content = await provider.call(messages, options);
                console.log(`[Manager] ${provider.name} succeeded`);
                // @ts-ignore
                return { provider: provider.name, content };
            } catch (e) {
                lastError = e as Error;
                errors.push(`${provider.name}: ${(e as Error).message}`);
                console.warn(`[Manager] ${provider.name} failed:`, (e as Error).message);
            }
        }

        throw new Error(`All providers failed. Errors: ${errors.join(' | ')}`);
    }

    async checkHealth() {
        return Promise.all(this.providers.map(async p => ({
            name: p.name,
            healthy: await p.health()
        })));
    }
}

export const providerManager = new ProviderManager();
