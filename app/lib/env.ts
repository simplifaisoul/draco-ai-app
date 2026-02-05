export const ENV = {
    enableWebSearch: process.env.ENABLE_WEB_SEARCH === 'true',
    pollinationsApiKey: process.env.POLLINATIONS_API_KEY,
};

export function validateEnv() {
    if (!ENV.pollinationsApiKey) {
        console.warn('⚠️ POLLINATIONS_API_KEY is not set. Get your API key at https://enter.pollinations.ai');
        console.warn('⚠️ The chat functionality will not work without this key.');
    }
}
