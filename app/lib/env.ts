export const ENV = {
    enableWebSearch: process.env.ENABLE_WEB_SEARCH === 'true',
};

export function validateEnv() {
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey');
    }
}
