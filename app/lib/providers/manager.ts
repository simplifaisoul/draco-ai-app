import { GeminiProvider } from './gemini';
import { Message, CallOptions, ProviderResponse, AIProvider } from './types';

export class ProviderManager {
    private providers: AIProvider[];

    constructor() {
        this.providers = [
            new GeminiProvider(),       // Primary & only provider
        ];
    }

    async callWithFallback(messages: Message[], options?: CallOptions): Promise<ProviderResponse> {
        let lastError: Error | null = null;

        for (const provider of this.providers) {
            if (!provider.isAvailable) continue;

            try {
                const content = await provider.call(messages, options);
                // @ts-ignore
                return { provider: provider.name, content };
            } catch (e) {
                lastError = e as Error;
                console.error(`[Manager] ${provider.name} failed:`, (e as Error).message);
            }
        }

        // Include helpful debug info in the error
        const keyCount = process.env.GEMINI_API_KEY ? 1 : 0;
        const backupCount = process.env.GEMINI_API_KEYS_BACKUP ? process.env.GEMINI_API_KEYS_BACKUP.split(',').length : 0;
        throw new Error(`Gemini API failed (${keyCount + backupCount} keys configured). Error: ${lastError?.message}`);
    }

    async checkHealth() {
        return Promise.all(this.providers.map(async p => ({
            name: p.name,
            healthy: await p.health()
        })));
    }
}

export const providerManager = new ProviderManager();
