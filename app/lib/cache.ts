interface CacheEntry {
    response: string;
    timestamp: number;
    provider: string;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export function generateCacheKey(messages: any[]): string {
    const recentMessages = messages.slice(-3);
    return JSON.stringify(recentMessages);
}

export function getCachedResponse(messages: any[]): {
    response: string;
    provider: string;
} | null {
    const key = generateCacheKey(messages);
    const cached = responseCache.get(key);

    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_TTL) {
        responseCache.delete(key);
        return null;
    }

    return {
        response: cached.response,
        provider: cached.provider,
    };
}

export function setCachedResponse(
    messages: any[],
    response: string,
    provider: string
): void {
    const key = generateCacheKey(messages);
    responseCache.set(key, {
        response,
        timestamp: Date.now(),
        provider,
    });
}
