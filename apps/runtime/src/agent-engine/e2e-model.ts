import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
    LanguageModelV4CallOptions,
    LanguageModelV4GenerateResult,
    LanguageModelV4StreamPart,
    LanguageModelV4Usage,
} from '@ai-sdk/provider';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const defaultModelId = 'tavern-e2e-tools';
const usage = {
    inputTokens: { cacheRead: undefined, cacheWrite: undefined, noCache: 16, total: 16 },
    outputTokens: { reasoning: undefined, text: 8, total: 8 },
    raw: { completion_tokens: 8, prompt_tokens: 16, total_tokens: 24 },
} satisfies LanguageModelV4Usage;

export function createE2eLanguageModel(modelId = defaultModelId) {
    return new MockLanguageModelV4({
        doGenerate: async (options) => {
            const scenario = buildScenario(options);
            return generatedScenario(scenario);
        },
        modelId,
        provider: 'tavern-e2e',
        doStream: async (options) => {
            const scenario = buildScenario(options);

            return {
                stream: simulateReadableStream({
                    chunks: scenario.chunks,
                    chunkDelayInMs: scenario.chunkDelayMs,
                    initialDelayInMs: scenario.initialDelayMs,
                }),
            };
        },
    });
}

function buildScenario(options: LanguageModelV4CallOptions) {
    const prompt = extractLatestUserText(options.prompt);
    const transcript = extractTranscriptText(options.prompt);
    const toolOutput = extractLatestToolOutput(options.prompt);
    const toolOutputCount = countToolOutputs(options.prompt);
    const toolCalls = selectToolCalls(prompt, toolOutputCount);
    const preamble = selectPreamble(prompt, toolOutputCount);
    const streamText =
        toolCalls.length > 0 || shouldReturnEmptyReply(transcript)
            ? ''
            : `${preamble}${selectReply(prompt, toolOutput)}`;
    const generatedText = shouldReturnEmptyReply(transcript)
        ? ''
        : `${preamble}${selectReply(prompt, toolOutput)}`;
    const chunks: LanguageModelV4StreamPart[] = [
        { type: 'stream-start', warnings: [] },
        {
            id: `chatcmpl_tavern_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
            modelId: readString(process.env.TAVERN_AGENT_MODEL) ?? defaultModelId,
            timestamp: new Date(),
            type: 'response-metadata',
        },
    ];

    if (shouldEmitReasoning(prompt)) {
        chunks.push(
            { id: 'reasoning-1', type: 'reasoning-start' },
            {
                delta: 'I should show this reasoning summary in Tavern.',
                id: 'reasoning-1',
                type: 'reasoning-delta',
            },
            { id: 'reasoning-1', type: 'reasoning-end' }
        );
    }

    if (preamble && toolCalls.length > 0) {
        chunks.push(...textChunks(preamble));
    }

    for (const toolCall of toolCalls) {
        chunks.push(...toolCallChunks(toolCall));
    }

    if (streamText && toolCalls.length === 0) {
        chunks.push(...textChunks(streamText));
    }

    chunks.push({
        finishReason: {
            raw: toolCalls.length > 0 ? 'tool-calls' : 'stop',
            unified: toolCalls.length > 0 ? 'tool-calls' : 'stop',
        },
        type: 'finish',
        usage,
    });

    return {
        chunkDelayMs: 5,
        chunks,
        generatedText,
        initialDelayMs: finalReplyDelayMs(prompt, toolOutput),
        preamble,
        toolCalls,
    };
}

function generatedScenario(
    scenario: ReturnType<typeof buildScenario>
): LanguageModelV4GenerateResult {
    if (scenario.toolCalls.length > 0) {
        return {
            content: [
                ...(scenario.preamble ? [{ text: scenario.preamble, type: 'text' } as const] : []),
                ...scenario.toolCalls.map((toolCall) => ({
                    input: toolCall.input,
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    type: 'tool-call' as const,
                })),
            ],
            finishReason: { raw: 'tool-calls', unified: 'tool-calls' },
            usage,
            warnings: [],
        };
    }

    return {
        content: scenario.generatedText ? [{ text: scenario.generatedText, type: 'text' }] : [],
        finishReason: { raw: 'stop', unified: 'stop' },
        usage,
        warnings: [],
    };
}

function toolCallChunks(toolCall: E2eToolCall): LanguageModelV4StreamPart[] {
    return [
        {
            id: toolCall.id,
            toolName: toolCall.name,
            type: 'tool-input-start',
        },
        {
            delta: toolCall.input,
            id: toolCall.id,
            type: 'tool-input-delta',
        },
        {
            id: toolCall.id,
            type: 'tool-input-end',
        },
        {
            input: toolCall.input,
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            type: 'tool-call',
        },
    ];
}

function textChunks(text: string): LanguageModelV4StreamPart[] {
    if (!text) {
        return [];
    }

    const id = `text-${crypto.randomUUID().slice(0, 8)}`;
    const chunks: LanguageModelV4StreamPart[] = [{ id, type: 'text-start' }];

    for (let index = 0; index < text.length; index += 12) {
        chunks.push({ delta: text.slice(index, index + 12), id, type: 'text-delta' });
    }

    chunks.push({ id, type: 'text-end' });
    return chunks;
}

function selectToolCalls(prompt: string, toolOutputCount: number) {
    if (!shouldUseTool(prompt)) {
        return [];
    }
    if (shouldRunMultiStageProgress(prompt) && toolOutputCount < 2) {
        return [buildToolCall(prompt, toolOutputCount)];
    }
    if (toolOutputCount > 0) {
        return [];
    }

    const requestedCount = prompt.match(/(?:use|run)\s+(\d+)\s+tools/iu)?.[1];
    const count = requestedCount ? Math.min(Number(requestedCount), 5) : 1;
    return Array.from({ length: count }, (_, index) => buildToolCall(prompt, index));
}

function buildToolCall(prompt: string, index: number): E2eToolCall {
    const name = chooseToolName(prompt);

    return {
        id: `call_tavern_${index}_${crypto.randomUUID().slice(0, 8)}`,
        input: JSON.stringify(buildToolArgs(name, prompt)),
        name,
    };
}

function chooseToolName(prompt: string) {
    if (shouldRunClarification(prompt)) {
        return 'ask_question';
    }
    if (/multi-stage progress|slow QA command|reload-heavy|subagent recovery/iu.test(prompt)) {
        return 'bash';
    }
    return 'read_file';
}

function buildToolArgs(toolName: string, prompt: string) {
    const taskPath = path.join(workspaceDir(), 'QA_KICKOFF_TASK.md');
    if (toolName === 'ask_question') {
        return {
            allowFreeform: false,
            options: [
                { id: 'Los Angeles', label: 'Los Angeles' },
                { id: 'San Francisco', label: 'San Francisco' },
                { id: 'San Diego', label: 'San Diego' },
                { id: 'Sacramento', label: 'Sacramento' },
            ],
            prompt: 'Which part of California?',
        };
    }
    if (toolName === 'bash') {
        const sleepPrefix = /slow QA command|reload-heavy|subagent recovery/iu.test(prompt)
            ? 'sleep 4 && '
            : '';
        return {
            command: `${sleepPrefix}cat ${JSON.stringify(taskPath)}`,
            workdir: workspaceDir(),
        };
    }
    return { path: taskPath };
}

function selectReply(prompt: string, toolOutput: string) {
    if (shouldRunClarification(prompt)) {
        return selectClarificationReply(prompt, toolOutput);
    }
    if (shouldRenderRichResponse(prompt)) {
        return richResponseReply(prompt);
    }

    return (
        (/thinking visibility check/iu.test(prompt) && 'THINKING-MAX-OK') ||
        prompt.match(/reply exactly `([^`]+)`/iu)?.[1] ||
        prompt.match(/Use exact marker: `([^`]+)`/iu)?.[1] ||
        'QA_AGENT_OK'
    );
}

function selectClarificationReply(prompt: string, toolOutput: string) {
    const marker = prompt.match(/reply exactly `([^`]+)`/iu)?.[1] ?? 'CLARIFICATION-OK';
    const response = extractClarificationResponse(toolOutput);

    if (/clarification skip qa/iu.test(prompt)) {
        return /cancelled|best judgement/iu.test(response)
            ? marker
            : `CLARIFICATION-SKIP-MISSING:${response}`;
    }

    return response === 'San Francisco' ? marker : `CLARIFICATION-ANSWER:${response}`;
}

function extractClarificationResponse(toolOutput: string) {
    const parsed = safeJsonRecord(toolOutput);
    const response = parsed
        ? (readNestedString(parsed, 'text') ??
          readNestedString(parsed, 'optionId') ??
          readNestedString(parsed, 'user_response'))
        : null;

    return response ?? toolOutput;
}

function richResponseReply(prompt: string) {
    const marker = prompt.match(/reply exactly `([^`]+)`/iu)?.[1] ?? 'QA_AGENT_OK';

    if (/table/iu.test(prompt)) {
        return richResponseTableReply(marker);
    }

    return [
        'Here is the revenue chart.',
        '',
        '```spec',
        '{"op":"add","path":"/root","value":"chart"}',
        '{"op":"add","path":"/elements/chart","value":{"type":"BarChart","props":{"data":[{"month":"Jan","revenue":12500},{"month":"Feb","revenue":18250},{"month":"Mar","revenue":21750}],"series":[{"key":"revenue","label":"Revenue"}],"title":"E2E Rich Response revenue","unit":"USD","xKey":"month"},"children":[]}}',
        '```',
        '',
        marker,
    ].join('\n');
}

function richResponseTableReply(marker: string) {
    const rows = Array.from({ length: 24 }, (_, index) => ({
        amount: `$${((index + 1) * 1234).toLocaleString('en-US')}`,
        owner: `Team ${String.fromCharCode(65 + (index % 6))}`,
        quarter: `Q${(index % 4) + 1} 2026`,
        status: index % 3 === 0 ? 'Investigating variance' : 'On track',
    }));

    return [
        'Here is the table.',
        '',
        '```spec',
        JSON.stringify({ op: 'add', path: '/root', value: 'table' }),
        JSON.stringify({
            op: 'add',
            path: '/elements/table',
            value: {
                children: [],
                props: {
                    columns: [
                        { key: 'quarter', label: 'Quarter' },
                        { key: 'owner', label: 'Owner' },
                        { align: 'right', key: 'amount', label: 'Amount' },
                        { key: 'status', label: 'Status' },
                    ],
                    rows,
                },
                type: 'Table',
            },
        }),
        '```',
        '',
        marker,
    ].join('\n');
}

function selectPreamble(prompt: string, toolOutputCount: number) {
    if (shouldRunMultiStageProgress(prompt)) {
        if (toolOutputCount === 0) {
            return 'I will inspect the fixture first.';
        }
        if (toolOutputCount === 1) {
            return 'I found the fixture and will verify it one more time.';
        }
        return '';
    }

    return toolOutputCount === 0 && /mid-turn progress|interim assistant/iu.test(prompt)
        ? 'I will inspect the workspace before running the command.'
        : '';
}

function finalReplyDelayMs(prompt: string, toolOutput: string) {
    if (!toolOutput) {
        return 0;
    }
    if (shouldRenderRichResponse(prompt)) {
        return 5000;
    }
    return /slow QA command|reload-heavy/iu.test(prompt) ? 8000 : 0;
}

function extractLatestUserText(messages: LanguageModelV4CallOptions['prompt']) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role === 'user') {
            const text = stringifyContent(message.content).trim();
            if (text) {
                return text;
            }
        }
    }
    return '';
}

function extractLatestToolOutput(messages: LanguageModelV4CallOptions['prompt']) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role === 'tool') {
            return stringifyContent(message.content).trim();
        }
    }
    return '';
}

function countToolOutputs(messages: LanguageModelV4CallOptions['prompt']) {
    return messages.filter((message) => message.role === 'tool').length;
}

function extractTranscriptText(messages: LanguageModelV4CallOptions['prompt']) {
    return messages
        .map((message) => stringifyContent(message.content))
        .filter(Boolean)
        .join('\n');
}

function stringifyContent(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return stringifyUnknown(content);
    }
    return content
        .map((entry) => {
            const record = asRecord(entry);
            if (record.type === 'text') {
                return readString(record.text) ?? '';
            }
            if (record.type === 'tool-result') {
                return stringifyUnknown(record.output ?? record.result);
            }
            return (
                readString(record.text) ?? readString(record.content) ?? stringifyUnknown(record)
            );
        })
        .filter(Boolean)
        .join('\n');
}

function stringifyUnknown(value: unknown) {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return '';
    }
    return JSON.stringify(value);
}

function workspaceDir() {
    const explicitWorkspace = process.env.TAVERN_AGENT_WORKSPACE;
    if (explicitWorkspace) {
        return explicitWorkspace;
    }
    const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
    return path.join(
        workspaceRoot,
        '.context',
        'e2e',
        runId,
        'tavern-runtime',
        'agent',
        'workspace'
    );
}

function shouldReturnEmptyReply(transcript: string) {
    return /Empty response exhaustion/iu.test(transcript);
}

function shouldUseTool(prompt: string) {
    return /QA_KICKOFF_TASK\.md|tool progress|slow QA command|reload-heavy|subagent recovery|(?:use|run)\s+\d+\s+tools|multi-stage progress|clarification (?:choice|skip) qa/iu.test(
        prompt
    );
}

function shouldRenderRichResponse(prompt: string) {
    return /rich response progress/iu.test(prompt);
}

function shouldRunClarification(prompt: string) {
    return /clarification (?:choice|skip) qa/iu.test(prompt);
}

function shouldEmitReasoning(prompt: string) {
    return /thinking visibility|reasoning/iu.test(prompt);
}

function shouldRunMultiStageProgress(prompt: string) {
    return /multi-stage progress/iu.test(prompt);
}

function safeJsonRecord(value: string) {
    try {
        return asRecord(JSON.parse(value) as unknown);
    } catch {
        return null;
    }
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : null;
}

function readNestedString(value: unknown, key: string): string | null {
    const direct = asRecord(value)[key];
    const directValue = readString(direct);
    if (directValue) {
        return directValue;
    }
    if (Array.isArray(value)) {
        for (const entry of value) {
            const nested = readNestedString(entry, key);
            if (nested) {
                return nested;
            }
        }
        return null;
    }
    const record = asRecord(value);
    for (const entry of Object.values(record)) {
        const nested = readNestedString(entry, key);
        if (nested) {
            return nested;
        }
    }
    return null;
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

interface E2eToolCall {
    id: string;
    input: string;
    name: string;
}
