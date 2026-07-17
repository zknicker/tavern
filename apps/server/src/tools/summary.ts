import type { NormalizedModel } from '../model/identity.ts';
import { normalizeModelIdentity } from '../model/identity.ts';
import type { SessionMessage } from '../sessions/contracts.ts';
import type { ToolCall, ToolFact } from './contracts.ts';
import { buildToolLabel } from './label.ts';
import { isRecord, resolveToolValue } from './values.ts';

export interface ToolSummary extends ToolCall {}

const preferredArgumentKeys = [
    'agentId',
    'label',
    'mode',
    'runtime',
    'path',
    'filePath',
    'file_path',
    'sessionKey',
    'target',
    'url',
    'query',
    'pattern',
    'command',
    'cmd',
] as const;

const preferredResultKeys = [
    'mode',
    'childSessionKey',
    'sessionKey',
    'runId',
    'failureKind',
    'reason',
    'path',
    'transcriptPath',
    'streamLogPath',
    'rowCount',
    'message',
    'note',
    'output',
] as const;

const shellToolNames = ['bash', 'command', 'exec', 'shell', 'terminal', 'zsh'] as const;

const readToolNames = ['grep', 'read', 'search'] as const;

const toolLabelByKey: Partial<Record<string, string>> = {
    agentId: 'Agent',
    childSessionKey: 'Session',
    cmd: 'Command',
    command: 'Command',
    error: 'Error',
    filePath: 'File',
    file_path: 'File',
    label: 'Label',
    message: 'Message',
    mode: 'Mode',
    note: 'Note',
    output: 'Output',
    path: 'Path',
    reason: 'Reason',
    pattern: 'Pattern',
    query: 'Query',
    rowCount: 'Rows',
    runId: 'Run',
    runtime: 'Runtime',
    sessionKey: 'Session',
    target: 'Target',
    url: 'URL',
    transcriptPath: 'Transcript',
    streamLogPath: 'Log',
};

function formatToolStatusValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function inferToolStatus(result: Record<string, unknown> | null) {
    if (!result) {
        return null;
    }

    if (result.timedOut === true) {
        return 'timeout';
    }

    const failureKind = formatToolStatusValue(result.failureKind);

    if (failureKind) {
        return failureKind;
    }

    const exitCode = result.exitCode;

    if (typeof exitCode === 'number' && Number.isFinite(exitCode) && exitCode !== 0) {
        return `exit ${exitCode}`;
    }

    return null;
}

function buildToolFacts(
    source: Record<string, unknown>,
    keys: readonly string[],
    tone: ToolFact['tone'],
    seen: Set<string>
) {
    const facts: ToolFact[] = [];

    for (const key of keys) {
        const value = resolveToolValue(source[key]);

        if (!value) {
            continue;
        }

        const label = toolLabelByKey[key] ?? key;
        const identity = `${label}:${value}`;

        if (seen.has(identity)) {
            continue;
        }

        seen.add(identity);
        facts.push({
            label,
            tone,
            value,
        });
    }

    return facts;
}

function matchesToolName(normalizedName: string, needles: readonly string[]) {
    return needles.some((needle) => normalizedName === needle || normalizedName.includes(needle));
}

function getArgumentString(
    argumentsValue: Record<string, unknown> | null,
    keys: readonly string[]
) {
    for (const key of keys) {
        const value = argumentsValue ? resolveToolValue(argumentsValue[key]) : null;

        if (value) {
            return value;
        }
    }

    return null;
}

// Summary parts describe intent only: they are derived exclusively from the
// tool arguments (never the result) so rows never leak output text.
function buildSummaryParts(input: {
    argumentsValue: Record<string, unknown> | null;
    label: string | null;
    name: string;
}): string[] {
    const normalizedName = input.name.trim().toLowerCase();

    if (matchesToolName(normalizedName, shellToolNames)) {
        const command = getArgumentString(input.argumentsValue, ['command', 'cmd']);

        if (command) {
            return [command];
        }
    }

    if (matchesToolName(normalizedName, readToolNames)) {
        const path = getArgumentString(input.argumentsValue, [
            'path',
            'file',
            'file_path',
            'filePath',
        ]);
        const pattern = getArgumentString(input.argumentsValue, ['pattern', 'query']);

        if (path && pattern) {
            return [`${pattern} in ${path}`];
        }

        if (path) {
            return [path];
        }

        if (pattern) {
            return [pattern];
        }
    }

    if (normalizedName === 'workspace_changes') {
        const count = Array.isArray(input.argumentsValue?.changes)
            ? input.argumentsValue.changes.length
            : 0;
        return [count === 1 ? '1 file' : `${count} files`];
    }

    const salient = getArgumentString(input.argumentsValue, preferredArgumentKeys);

    if (salient) {
        return [salient];
    }

    return input.label ? [input.label] : [];
}

function getToolCallPart(partsValue: unknown) {
    const parts = Array.isArray(partsValue) ? partsValue : [];
    return parts.find((part) => isRecord(part) && part.type === 'toolCall');
}

function parseToolResult(content: string) {
    const normalizedContent = content.trim();

    if (!(normalizedContent.startsWith('{') || normalizedContent.startsWith('['))) {
        return null;
    }

    try {
        const parsed = JSON.parse(normalizedContent) as unknown;
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function buildToolSummaryFromValues(input: {
    argumentsValue: unknown;
    callId: string | null;
    isError?: boolean | null;
    model?: NormalizedModel | null;
    name: string;
    resultValue: unknown;
}) {
    const argumentsValue = isRecord(input.argumentsValue) ? input.argumentsValue : null;
    const toolResult = isRecord(input.resultValue) ? input.resultValue : null;
    const seen = new Set<string>();
    const argumentFacts = argumentsValue
        ? buildToolFacts(argumentsValue, preferredArgumentKeys, 'default', seen)
        : [];
    const resultFacts = toolResult
        ? buildToolFacts(toolResult, preferredResultKeys, 'success', seen)
        : [];
    const facts = [...argumentFacts, ...resultFacts];
    const errorText = toolResult ? resolveToolValue(toolResult.error) : null;
    let status = toolResult
        ? (formatToolStatusValue(toolResult.status) ?? inferToolStatus(toolResult))
        : null;

    if (!status && input.isError) {
        status = 'error';
    }

    if (!status && errorText) {
        status = 'error';
    }

    if (errorText) {
        const errorIdentity = `Error:${errorText}`;

        if (!seen.has(errorIdentity)) {
            seen.add(errorIdentity);
            facts.push({
                label: 'Error',
                tone: 'danger',
                value: errorText,
            });
        }
    }

    const intentLabel = buildToolLabel({
        argumentsValue,
        facts: argumentFacts,
        name: input.name,
        resultValue: null,
        status: null,
    });
    const summaryParts = buildSummaryParts({
        argumentsValue,
        label: intentLabel,
        name: input.name,
    });
    const label = buildToolLabel({
        argumentsValue,
        facts,
        name: input.name,
        resultValue: toolResult,
        status,
    });

    return {
        callId: input.callId,
        facts: facts.slice(0, 6),
        label,
        model: input.model ?? undefined,
        name: input.name,
        status,
        summaryParts,
    } satisfies ToolSummary;
}

export function buildToolSummary(message: SessionMessage): ToolSummary | null {
    const toolCallPart = getToolCallPart(message.metadata?.parts);
    const toolResult = parseToolResult(message.content);
    const argumentsValue = isRecord(toolCallPart?.arguments) ? toolCallPart.arguments : null;
    const toolName =
        (typeof toolCallPart?.name === 'string' ? toolCallPart.name : null) ??
        message.metadata?.toolName ??
        null;
    const callId =
        (typeof toolCallPart?.id === 'string' ? toolCallPart.id : null) ??
        message.metadata?.toolCallId ??
        null;

    if (!(toolName || callId)) {
        return null;
    }

    return buildToolSummaryFromValues({
        argumentsValue,
        callId,
        isError: message.metadata?.isError,
        model: normalizeModelIdentity({
            model: message.metadata?.model,
            provider: message.metadata?.provider,
        }),
        name: toolName ?? 'tool',
        resultValue: toolResult,
    });
}

export function mergeToolSummary(invocation: ToolSummary | null, result: ToolSummary | null) {
    if (!(invocation || result)) {
        return null;
    }

    if (!invocation) {
        return result;
    }

    if (!result) {
        return invocation;
    }

    const seenFacts = new Set<string>();
    const facts = [...invocation.facts, ...result.facts].filter((fact) => {
        const identity = `${fact.label}:${fact.value}:${fact.tone}`;

        if (seenFacts.has(identity)) {
            return false;
        }

        seenFacts.add(identity);
        return true;
    });
    const summaryParts = [...invocation.summaryParts, ...result.summaryParts].filter(
        (part, index, all) => part.length > 0 && all.indexOf(part) === index
    );

    return {
        callId: result.callId ?? invocation.callId,
        facts,
        label: result.label ?? invocation.label,
        model: result.model ?? invocation.model,
        name: invocation.name ?? result.name,
        status: result.status ?? invocation.status,
        summaryParts,
    };
}
