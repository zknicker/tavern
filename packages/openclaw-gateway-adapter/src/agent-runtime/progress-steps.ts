import type { AgentRuntimeEvent } from '@tavern/agent-runtime-protocol';
import { asRecord, readString } from '../gateway/records.ts';

export type AgentRuntimeTurnProgressStep = Extract<
    AgentRuntimeEvent,
    { type: 'turn.progress' }
>['step'];

export function createToolStep(data: Record<string, unknown>, payload: Record<string, unknown>) {
    const id = readStableToolProgressId(data, payload);

    if (!id) {
        return null;
    }

    const target = readToolTarget(data);
    const label = `Used ${target ?? readToolName(data) ?? 'tool'}`;

    return {
        detail: readToolProgressDetail(data),
        id,
        kind: 'tool' as const,
        label,
        status: readProgressStatus(data),
    };
}

export function createCommandOutputStep(
    data: Record<string, unknown>,
    payload: Record<string, unknown>
) {
    const id = readStableToolProgressId(data, payload);

    if (!id) {
        return null;
    }

    const target = readToolTarget(data);
    const label = `Used ${target ?? readToolName(data) ?? 'command'}`;

    return {
        detail: formatCommandOutputDetail(data),
        id,
        kind: 'tool' as const,
        label,
        status: readProgressStatus(data),
    };
}

export function createThinkingStep(data: Record<string, unknown>) {
    const detail = readReasoningText(data);

    if (!detail) {
        return null;
    }

    return {
        detail,
        id: 'reasoning',
        kind: 'reasoning' as const,
        label: 'Reasoning',
        status: 'active' as const,
    };
}

export function createPlanStep(data: Record<string, unknown>, payload: Record<string, unknown>) {
    const detail =
        readString(data, ['explanation']) ?? readStringArray(data, ['steps'])?.join('\n');

    if (!detail) {
        return null;
    }

    return {
        detail,
        id: readString(data, ['source', 'title']) ?? `plan:${readString(payload, ['runId'])}`,
        kind: 'plan' as const,
        label: readString(data, ['title']) ?? 'Updated plan',
        status: readProgressStatus(data),
    };
}

export function createItemStep(data: Record<string, unknown>) {
    const kind = readString(data, ['kind']);
    const title = readString(data, ['title', 'name']);
    const detail = readReasoningText(data);

    if (kind === 'tool' || kind === 'command') {
        return null;
    }

    if (kind === 'reasoning' || title?.trim().match(/^(reasoning|thinking)$/iu)) {
        if (!detail) {
            return null;
        }

        return {
            detail,
            id: 'reasoning',
            kind: 'reasoning' as const,
            label: 'Reasoning',
            status: readProgressStatus(data),
        };
    }

    if (!detail) {
        return null;
    }

    return {
        detail,
        id: readString(data, ['itemId', 'title', 'name']) ?? 'message',
        kind: 'message' as const,
        label: title ?? 'Working',
        status: readProgressStatus(data),
    };
}

function readProgressStatus(data: Record<string, unknown>) {
    const status = readString(data, ['status']);
    const phase = readString(data, ['phase']);

    if (status === 'failed' || phase === 'failed' || data.isError === true) {
        return 'failed' as const;
    }

    if (status === 'completed' || phase === 'completed' || phase === 'end' || phase === 'result') {
        return 'completed' as const;
    }

    return 'active' as const;
}

function readToolProgressDetail(data: Record<string, unknown>) {
    if (readProgressStatus(data) !== 'active') {
        return formatCommandOutputDetail(data) ?? readFirstString(data, ['summary', 'status']);
    }

    return readToolTarget(data) ? undefined : readFirstString(data, ['phase', 'status']);
}

function readStableToolProgressId(data: Record<string, unknown>, payload: Record<string, unknown>) {
    const stableId = readFirstString(data, ['toolCallId', 'callId', 'id', 'itemId']);

    if (stableId) {
        return stableId;
    }

    const seq = payload.seq;
    const key = normalizeProgressKeyText(readToolName(data) ?? readToolTarget(data));

    return key && typeof seq === 'number' ? `tool:${key}:${seq}` : null;
}

function readToolTarget(data: Record<string, unknown>) {
    return (
        readFirstString(data, ['title', 'summary', 'progressText', 'meta', 'command', 'cmd']) ??
        formatToolArgs(asRecord(data.args))
    );
}

function readToolName(data: Record<string, unknown>) {
    return readFirstString(data, ['name', 'toolName']);
}

function formatToolArgs(args: Record<string, unknown>) {
    const command = readFirstString(args, [
        'command',
        'cmd',
        'script',
        'input',
        'shellCommand',
        'query',
        'path',
        'file',
    ]);

    if (command) {
        return command;
    }

    const commandArray = readStringArray(args, ['argv', 'args']);

    if (commandArray) {
        return commandArray.map(quoteCommandArg).join(' ');
    }

    const entries = Object.entries(args)
        .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${value}`);

    return entries.length > 0 ? entries.join(', ') : undefined;
}

function quoteCommandArg(value: string) {
    return /\s/u.test(value) ? JSON.stringify(value) : value;
}

function formatCommandOutputDetail(data: Record<string, unknown>) {
    const duration = formatDurationMs(data.durationMs);
    const status = data.exitCode === 0 ? 'completed' : readFirstString(data, ['status']);

    return [status, duration].filter(Boolean).join(' ') || undefined;
}

function formatDurationMs(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value)
        ? `${(value / 1000).toFixed(1)}s`
        : undefined;
}

function readReasoningText(data: Record<string, unknown>) {
    return readFirstString(data, [
        'text',
        'delta',
        'summary',
        'progressText',
        'content',
        'message',
    ]);
}

function readFirstString(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = record[key];

        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }

    return undefined;
}

function readStringArray(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = record[key];

        if (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((item) => typeof item === 'string')
        ) {
            return value;
        }
    }

    return undefined;
}

function normalizeProgressKeyText(value: string | undefined) {
    return value?.trim().replaceAll(/\s+/g, ' ').toLowerCase() ?? '';
}
