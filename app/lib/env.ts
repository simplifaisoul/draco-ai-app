export const ENV = {
    groqApiKey: process.env.GROQ_API_KEY || '',
    enableWebSearch: process.env.ENABLE_WEB_SEARCH === 'true',
};

export function validateEnv() {
    if (!ENV.groqApiKey) {
        console.warn('[Warning] GROQ_API_KEY not configured. Fallback to Groq will not be available.');
    }
}
