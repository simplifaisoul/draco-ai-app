import { PollinationsProvider } from './pollinations';
import { GroqProvider } from './groq';
import { Message, CallOptions, ProviderResponse, AIProvider } from './types';

export class ProviderManager {
    private providers: AIProvider[];

    constructor() {
        this.providers = [
            new PollinationsProvider(),
            new GroqProvider(),
        ].sort((a, b) => a.priority - b.priority);
    }

    async callWithFallback(messages: Message[], options?: CallOptions): Promise<ProviderResponse> {
        let lastError: Error | null = null;

        for (const provider of this.providers) {
            if (!provider.isAvailable) continue;

            try {
                console.log(`[Manager] Trying ${provider.name}...`);
                const content = await provider.call(messages, options);
                return { provider: provider.name, content };
            } catch (e) {
                lastError = e as Error;
                console.warn(`[Manager] ${provider.name} failed:`, e);
            }
        }

        throw new Error(`All providers failed. Last error: ${lastError?.message}`);
    }

    async checkHealth() {
        return Promise.all(this.providers.map(async p => ({
            name: p.name,
            healthy: await p.health()
        })));
    }
}

export const providerManager = new ProviderManager();
