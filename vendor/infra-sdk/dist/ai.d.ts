import type { InfraClientOptions, Result } from './types.js';
export type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama' | 'custom';
export type AiMessageRole = 'system' | 'user' | 'assistant';
export interface AiTextPart {
    type: 'text';
    text: string;
}
export interface AiImagePart {
    type: 'image_url';
    image_url: {
        url: string;
    };
}
export type AiMessageContent = string | Array<AiTextPart | AiImagePart>;
export interface AiChatMessage {
    role: AiMessageRole;
    content: AiMessageContent;
}
export interface AiChatInput {
    messages: AiChatMessage[];
    model?: string;
    provider?: AiProvider;
    fallback?: boolean;
    temperature?: number;
    maxTokens?: number;
    jsonSchema?: Record<string, unknown>;
    systemPrompt?: string;
}
export interface AiUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export interface AiChatResult {
    content: string;
    provider: AiProvider;
    model: string;
    usage: AiUsage;
    durationMs: number;
}
export interface InfraAiClient {
    chat(input: AiChatInput): Promise<Result<AiChatResult>>;
    parse<T = unknown>(input: AiChatInput & {
        jsonSchema: Record<string, unknown>;
    }): Promise<Result<T>>;
    stream(input: AiChatInput, onChunk: (delta: string) => void): Promise<Result<string>>;
}
type WithAuth = <T>(run: (headers: Record<string, string>) => Promise<Result<T>>) => Promise<Result<T>>;
export declare function createAiClient(options: InfraClientOptions, withAuth?: WithAuth): InfraAiClient;
export {};
//# sourceMappingURL=ai.d.ts.map