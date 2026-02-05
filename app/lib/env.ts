export const ENV = {
    enableWebSearch: process.env.ENABLE_WEB_SEARCH === 'true',
};

export function validateEnv() {
    // No validation needed for Pollinations (free/public)
}
