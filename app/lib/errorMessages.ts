export enum ErrorType {
    RATE_LIMIT = 'rate_limit',
    API_DOWN = 'api_down',
    INTERNAL_ERROR = 'internal_error',
    INVALID_REQUEST = 'invalid_request',
}

const ERROR_MESSAGES: Record<ErrorType, { message: string }> = {
    [ErrorType.RATE_LIMIT]: { message: 'You are sending messages too quickly. Please wait a moment.' },
    [ErrorType.API_DOWN]: { message: 'AI providers are currently unavailable. We are retrying...' },
    [ErrorType.INTERNAL_ERROR]: { message: 'An unexpected error occurred.' },
    [ErrorType.INVALID_REQUEST]: { message: 'Invalid request format.' },
};

export function getErrorMessage(type: ErrorType) {
    return ERROR_MESSAGES[type];
}
