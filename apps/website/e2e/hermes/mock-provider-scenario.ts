import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const workspaceDir = path.join(
    workspaceRoot,
    '.context',
    'e2e',
    runId,
    'tavern-runtime',
    'hermes',
    'workspace'
);
const modelId = process.env.TAVERN_HERMES_MODEL ?? 'tavern-e2e-tools';

export function buildChatCompletion(body: Record<string, unknown>): ChatCompletionPayload {
    const messages = readArray(body.messages).map(asRecord);
    const prompt = extractLatestUserText(messages);
    const transcript = extractTranscriptText(messages);
    const toolOutput = extractLatestToolOutput(messages);
    const toolOutputCount = countToolOutputs(messages);
    const toolCalls = selectToolCalls(body, prompt, toolOutputCount);

    return {
        finalDelayMs: finalReplyDelayMs(prompt, toolOutput),
        id: `chatcmpl_tavern_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
        model: readString(body.model) ?? modelId,
        preamble: selectPreamble(prompt, toolOutputCount),
        reasoning: shouldEmitReasoning(prompt)
            ? 'I should show this reasoning summary in Tavern.'
            : '',
        text:
            toolCalls.length > 0 || shouldReturnEmptyReply(transcript)
                ? ''
                : selectReply(prompt, toolOutput),
        toolCalls,
    };
}

function selectToolCalls(body: Record<string, unknown>, prompt: string, toolOutputCount: number) {
    if (!shouldUseTool(prompt)) {
        return [];
    }
    if (shouldRunMultiStageProgress(prompt) && toolOutputCount < 2) {
        return [buildToolCall(body, prompt, toolOutputCount)];
    }
    if (toolOutputCount > 0) {
        return [];
    }

    const count = /(?:use|run)\s+3\s+tools/i.test(prompt) ? 3 : 1;
    return Array.from({ length: count }, (_, index) => buildToolCall(body, prompt, index));
}

function buildToolCall(body: Record<string, unknown>, prompt: string, index: number) {
    const available = readToolNames(body);
    const name = chooseToolName(available, prompt);

    return {
        arguments: JSON.stringify(buildToolArgs(name, prompt)),
        id: `call_tavern_${index}_${crypto.randomUUID().slice(0, 8)}`,
        name,
    };
}

function chooseToolName(available: Set<string>, prompt: string) {
    if (shouldRunClarification(prompt) && available.has('clarify')) {
        return 'clarify';
    }
    if (/multi-stage progress/i.test(prompt) && available.has('terminal')) {
        return 'terminal';
    }
    if (
        /slow QA command|reload-heavy|subagent recovery/i.test(prompt) &&
        available.has('terminal')
    ) {
        return 'terminal';
    }
    if (available.has('read_file')) {
        return 'read_file';
    }
    if (available.has('terminal')) {
        return 'terminal';
    }
    if (available.has('execute_code')) {
        return 'execute_code';
    }
    return [...available][0] ?? 'read_file';
}

function buildToolArgs(toolName: string, prompt: string) {
    const taskPath = path.join(workspaceDir, 'QA_KICKOFF_TASK.md');
    if (toolName === 'clarify') {
        return {
            choices: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
            question: 'Which part of California?',
        };
    }
    if (toolName === 'terminal') {
        const sleepPrefix = /slow QA command|reload-heavy|subagent recovery/i.test(prompt)
            ? 'sleep 4 && '
            : '';
        return { command: `${sleepPrefix}cat ${JSON.stringify(taskPath)}`, workdir: workspaceDir };
    }
    if (toolName === 'execute_code') {
        const delay = /slow QA command|reload-heavy|subagent recovery/i.test(prompt) ? 4 : 0;
        return {
            code: `import pathlib, time\ntime.sleep(${delay})\nprint(pathlib.Path(${JSON.stringify(taskPath)}).read_text())`,
        };
    }
    return { path: taskPath };
}

function readToolNames(body: Record<string, unknown>) {
    const names = new Set<string>();
    for (const tool of readArray(body.tools)) {
        const record = asRecord(tool);
        const functionRecord = asRecord(record.function);
        const name = readString(functionRecord.name) ?? readString(record.name);
        if (name) {
            names.add(name);
        }
    }
    return names;
}

function selectReply(prompt: string, toolOutput: string) {
    if (shouldRunClarification(prompt)) {
        return selectClarificationReply(prompt, toolOutput);
    }
    if (shouldRenderRichResponse(prompt)) {
        return richResponseReply(prompt);
    }

    return (
        (/thinking visibility check/i.test(prompt) && 'THINKING-MAX-OK') ||
        prompt.match(/reply exactly `([^`]+)`/iu)?.[1] ||
        prompt.match(/Use exact marker: `([^`]+)`/iu)?.[1] ||
        'QA_HERMES_OK'
    );
}

function shouldReturnEmptyReply(transcript: string) {
    return /Empty response exhaustion/i.test(transcript);
}

function shouldUseTool(prompt: string) {
    return /QA_KICKOFF_TASK\.md|tool progress|slow QA command|reload-heavy|subagent recovery|use\s+3\s+tools|multi-stage progress|clarification (?:choice|skip) qa/i.test(
        prompt
    );
}

function shouldRenderRichResponse(prompt: string) {
    return /rich response progress/i.test(prompt);
}

function richResponseReply(prompt: string) {
    const marker = prompt.match(/reply exactly `([^`]+)`/iu)?.[1] ?? 'QA_HERMES_OK';

    if (/table/i.test(prompt)) {
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

function shouldRunClarification(prompt: string) {
    return /clarification (?:choice|skip) qa/i.test(prompt);
}

function selectClarificationReply(prompt: string, toolOutput: string) {
    const marker = prompt.match(/reply exactly `([^`]+)`/iu)?.[1] ?? 'CLARIFICATION-OK';
    const response = extractClarificationResponse(toolOutput);

    if (/clarification skip qa/i.test(prompt)) {
        return /cancelled|best judgement/i.test(response)
            ? marker
            : `CLARIFICATION-SKIP-MISSING:${response}`;
    }

    return response === 'San Francisco' ? marker : `CLARIFICATION-ANSWER:${response}`;
}

function extractClarificationResponse(toolOutput: string) {
    const parsed = safeJsonRecord(toolOutput);
    const response = parsed ? readString(parsed.user_response) : null;

    return response ?? toolOutput;
}

function shouldEmitReasoning(prompt: string) {
    return /thinking visibility|reasoning/i.test(prompt);
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

    return /mid-turn progress|interim assistant/i.test(prompt)
        ? 'I will inspect the workspace before running the command.'
        : '';
}

function shouldRunMultiStageProgress(prompt: string) {
    return /multi-stage progress/i.test(prompt);
}

function finalReplyDelayMs(prompt: string, toolOutput: string) {
    if (!toolOutput) {
        return 0;
    }
    if (shouldRenderRichResponse(prompt)) {
        return 5000;
    }
    return /slow QA command|reload-heavy/i.test(prompt) ? 1200 : 0;
}

function extractLatestUserText(messages: Record<string, unknown>[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === 'user') {
            const text = stringifyContent(messages[index].content).trim();
            if (text) {
                return text;
            }
        }
    }
    return '';
}

function extractLatestToolOutput(messages: Record<string, unknown>[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === 'tool') {
            return stringifyContent(messages[index].content).trim();
        }
    }
    return '';
}

function countToolOutputs(messages: Record<string, unknown>[]) {
    return messages.filter((message) => message.role === 'tool').length;
}

function extractTranscriptText(messages: Record<string, unknown>[]) {
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
        return '';
    }
    return content
        .map((entry) => {
            const record = asRecord(entry);
            return readString(record.text) ?? readString(record.content) ?? '';
        })
        .filter(Boolean)
        .join('\n');
}

function readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function safeJsonRecord(value: string) {
    try {
        return asRecord(JSON.parse(value) as unknown);
    } catch {
        return null;
    }
}

interface ToolCallPayload {
    arguments: string;
    id: string;
    name: string;
}

export interface ChatCompletionPayload {
    finalDelayMs: number;
    id: string;
    model: string;
    preamble: string;
    reasoning: string;
    text: string;
    toolCalls: ToolCallPayload[];
}
