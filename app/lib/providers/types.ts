export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp?: string;
    thought?: string;
    isThinking?: boolean;
    reasoning_content?: string;
}

export interface CallOptions {
    temperature?: number;
    maxTokens?: number;
    model?: string;
}

export interface ProviderResponse {
    provider: string;
    content: string | ReadableStream;
}

export interface AIProvider {
    name: string;
    isAvailable: boolean;
    priority: number;
    call(messages: Message[], options?: CallOptions): Promise<string | ReadableStream>;
    health(): Promise<boolean>;
}
