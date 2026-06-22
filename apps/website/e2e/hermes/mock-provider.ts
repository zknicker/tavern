import { serve } from 'bun';
import { buildChatCompletion, type ChatCompletionPayload } from './mock-provider-scenario.ts';

const host = '127.0.0.1';
const modelId = process.env.TAVERN_HERMES_MODEL ?? 'tavern-e2e-tools';

export function createHermesModelProviderMock(input: { port: number }) {
    const requests: Record<string, unknown>[] = [];
    const server = serve({
        fetch: async (request) => handleRequest(request, requests),
        hostname: host,
        port: input.port,
    });

    return {
        baseUrl: `http://${host}:${server.port}`,
        requests,
        stop: () => server.stop(true),
    };
}

async function handleRequest(request: Request, requests: Record<string, unknown>[]) {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/readyz')) {
        return json({ ok: true, status: 'live' });
    }

    if (request.method === 'GET' && url.pathname === '/v1/models') {
        return json({ data: [{ id: modelId, object: 'model' }], object: 'list' });
    }

    if (request.method === 'GET' && url.pathname === '/debug/requests') {
        return json(requests);
    }

    if (request.method === 'POST' && url.pathname === '/v1/chat/completions') {
        const body = asRecord(safeJsonParse(await request.text()));
        requests.push(body);
        if (requests.length > 200) {
            requests.splice(0, requests.length - 200);
        }

        const payload = buildChatCompletion(body);
        if (body.stream !== true && payload.finalDelayMs > 0) {
            await sleep(payload.finalDelayMs);
        }
        return body.stream === true ? streamChatCompletion(payload) : json(toResponse(payload));
    }

    return json({ error: 'not found' }, { status: 404 });
}

function toResponse(payload: ChatCompletionPayload) {
    return {
        choices: [
            {
                finish_reason: payload.toolCalls.length > 0 ? 'tool_calls' : 'stop',
                index: 0,
                message: {
                    content: payload.text || null,
                    ...(payload.reasoning ? { reasoning: payload.reasoning } : {}),
                    role: 'assistant',
                    tool_calls:
                        payload.toolCalls.length > 0
                            ? payload.toolCalls.map(toOpenAiToolCall)
                            : undefined,
                    ...(payload.reasoning ? { reasoning_content: payload.reasoning } : {}),
                },
            },
        ],
        created: nowSeconds(),
        id: payload.id,
        model: payload.model,
        object: 'chat.completion',
        usage: usage(),
    };
}

function streamChatCompletion(payload: ChatCompletionPayload) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const enqueue = (chunk: unknown) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            };
            enqueue(streamChunk(payload, { role: 'assistant' }));
            if (payload.reasoning) {
                enqueue(
                    streamChunk(payload, {
                        reasoning: payload.reasoning,
                        reasoning_content: payload.reasoning,
                    })
                );
            }
            if (payload.preamble) {
                for (const chunk of chunkText(payload.preamble)) {
                    enqueue(streamChunk(payload, { content: chunk }));
                    await sleep(5);
                }
            }
            if (payload.toolCalls.length > 0) {
                emitToolCallChunks(payload, enqueue);
            } else {
                if (payload.finalDelayMs > 0) {
                    await sleep(payload.finalDelayMs);
                }
                for (const chunk of chunkText(payload.text)) {
                    enqueue(streamChunk(payload, { content: chunk }));
                    await sleep(5);
                }
                enqueue(streamChunk(payload, {}, 'stop'));
            }
            enqueue({
                choices: [],
                created: nowSeconds(),
                id: payload.id,
                model: payload.model,
                object: 'chat.completion.chunk',
                usage: usage(),
            });
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            'Cache-Control': 'no-store',
            Connection: 'keep-alive',
            'Content-Type': 'text/event-stream',
        },
    });
}

function emitToolCallChunks(payload: ChatCompletionPayload, enqueue: (chunk: unknown) => void) {
    for (let index = 0; index < payload.toolCalls.length; index += 1) {
        const toolCall = payload.toolCalls[index];
        enqueue(
            streamChunk(payload, {
                tool_calls: [
                    {
                        function: { arguments: toolCall.arguments, name: toolCall.name },
                        id: toolCall.id,
                        index,
                        type: 'function',
                    },
                ],
            })
        );
    }
    enqueue(streamChunk(payload, {}, 'tool_calls'));
}

function streamChunk(
    payload: ChatCompletionPayload,
    delta: Record<string, unknown>,
    finishReason: null | string = null
) {
    return {
        choices: [{ delta, finish_reason: finishReason, index: 0 }],
        created: nowSeconds(),
        id: payload.id,
        model: payload.model,
        object: 'chat.completion.chunk',
    };
}

function toOpenAiToolCall(toolCall: ToolCallPayload) {
    return {
        function: { arguments: toolCall.arguments, name: toolCall.name },
        id: toolCall.id,
        type: 'function',
    };
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function safeJsonParse(raw: string) {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function json(body: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(body), {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
}

function usage() {
    return { completion_tokens: 8, prompt_tokens: 16, total_tokens: 24 };
}

function chunkText(text: string) {
    const chunks: string[] = [];

    for (let index = 0; index < text.length; index += 12) {
        chunks.push(text.slice(index, index + 12));
    }

    return chunks.length > 0 ? chunks : [text];
}

function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ToolCallPayload {
    arguments: string;
    id: string;
    name: string;
}
