export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface CallOptions {
    temperature?: number;
    maxTokens?: number;
    model?: string;
}

export interface ProviderResponse {
    provider: string;
    content: string;
}

export interface AIProvider {
    name: string;
    isAvailable: boolean;
    priority: number;
    call(messages: Message[], options?: CallOptions): Promise<string>;
    health(): Promise<boolean>;
}
