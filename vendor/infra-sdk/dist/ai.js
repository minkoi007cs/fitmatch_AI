/**
 * AI Gateway SDK Client — multi-provider fallback, SSE streaming, JSON Schema output, Vision OCR.
 */
import { normaliseBaseUrl, request } from './http.js';
export function createAiClient(options, withAuth) {
    const call = async (runner) => {
        if (withAuth)
            return withAuth(runner);
        return runner({});
    };
    return {
        async chat(input) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/ai/chat',
                body: { ...input, stream: false },
                useApiKey: true,
            }));
        },
        async parse(input) {
            const chatRes = await call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/ai/chat',
                body: { ...input, stream: false },
                useApiKey: true,
            }));
            if (chatRes.error !== null)
                return { data: null, error: chatRes.error };
            try {
                const parsed = JSON.parse(chatRes.data.content);
                return { data: parsed, error: null };
            }
            catch {
                return {
                    data: null,
                    error: {
                        code: 'INTERNAL',
                        message: `AI returned invalid JSON: ${chatRes.data.content.slice(0, 100)}`,
                        requestId: 'ai-parse',
                    },
                };
            }
        },
        async stream(input, onChunk) {
            const fetchImpl = options.fetch ?? globalThis.fetch;
            if (typeof fetchImpl !== 'function') {
                return {
                    data: null,
                    error: { code: 'CONFIG_INVALID', message: 'no fetch implementation available', requestId: 'unknown' },
                };
            }
            const headers = {
                'content-type': 'application/json',
                accept: 'text/event-stream',
                ...(options.headers ?? {}),
            };
            if (options.apiKey)
                headers['authorization'] = `Bearer ${options.apiKey}`;
            try {
                const res = await fetchImpl(`${normaliseBaseUrl(options.baseUrl)}/api/v1/ai/chat`, {
                    method: 'POST',
                    // The hub bounds a streamed answer at 120 s; give it a little longer before giving up.
                    signal: AbortSignal.timeout(130_000),
                    headers,
                    body: JSON.stringify({ ...input, stream: true }),
                });
                if (!res.ok) {
                    const errText = await res.text();
                    return {
                        data: null,
                        error: {
                            code: 'INTERNAL',
                            message: `AI stream failed with status ${res.status}: ${errText.slice(0, 200)}`,
                            requestId: res.headers.get('x-request-id') ?? 'unknown',
                        },
                    };
                }
                if (!res.body) {
                    return {
                        data: null,
                        error: { code: 'INTERNAL', message: 'No response body received for streaming', requestId: 'unknown' },
                    };
                }
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullText = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.error) {
                                    return {
                                        data: null,
                                        error: { code: 'INTERNAL', message: data.error, requestId: 'stream-error' },
                                    };
                                }
                                if (data.delta) {
                                    fullText += data.delta;
                                    onChunk(data.delta);
                                }
                            }
                            catch {
                                // ignore SSE frame parse errors
                            }
                        }
                    }
                }
                return { data: fullText, error: null };
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    data: null,
                    error: { code: 'NETWORK_ERROR', message: msg, requestId: 'unknown' },
                };
            }
        },
    };
}
//# sourceMappingURL=ai.js.map