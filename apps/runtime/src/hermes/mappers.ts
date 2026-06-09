import type {
    AgentRuntimeAgent,
    AgentRuntimeSession,
    AgentRuntimeSessionMessage,
    AgentRuntimeSkillSummary,
    AgentRuntimeToolset,
} from '@tavern/api';
import { HERMES_WORKSPACE } from '../config';
import { defaultHermesAgentId } from './constants';

export function defaultHermesAgent(): AgentRuntimeAgent {
    return {
        avatar: null,
        enabledSkillIds: [],
        emoji: null,
        id: defaultHermesAgentId,
        isAdmin: true,
        name: 'Hermes',
        primaryColor: null,
        workspaceFolder: HERMES_WORKSPACE,
    };
}

export function mapHermesSession(value: unknown): AgentRuntimeSession {
    const record = asRecord(value);
    const sessionId = readString(record, ['id', 'session_id']) ?? 'hermes-session';
    const lastActive = readNumber(record.last_active) ?? readNumber(record.ended_at);
    const startedAt = readNumber(record.started_at);

    return {
        agentId: defaultHermesAgentId,
        chatId: `hermes:${sessionId}`,
        key: sessionId,
        lastActivityAt: unixSecondsToIso(lastActive),
        messageCount: readNumber(record.message_count) ?? 0,
        parentSessionKey: null,
        platform: 'hermes',
        sessionId,
        sessionRole: 'main',
        startedAt: unixSecondsToIso(startedAt),
        title: readString(record, ['title', 'preview']),
    };
}

export function mapHermesMessage(
    sessionKey: string,
    value: unknown,
    index: number
): AgentRuntimeSessionMessage {
    const record = asRecord(value);
    const role = readString(record, ['role']) ?? 'assistant';
    const senderType = role === 'user' ? 'user' : role === 'system' ? 'system' : 'agent';
    const content = readMessageContent(record.content ?? record.text);

    return {
        agentId: senderType === 'agent' ? defaultHermesAgentId : null,
        attachments: [],
        chatId: `hermes:${sessionKey}`,
        content,
        id: `${sessionKey}:${index}`,
        metadata: {},
        participant: null,
        sender: senderType === 'agent' ? defaultHermesAgentId : `hermes:${role}`,
        senderName: senderType === 'agent' ? 'Hermes' : role,
        senderType,
        sessionKey,
        timestamp: unixSecondsToIso(readNumber(record.timestamp)) ?? new Date().toISOString(),
    };
}

export function mapHermesSkill(value: unknown): AgentRuntimeSkillSummary {
    const record = asRecord(value);
    const id = readString(record, ['id', 'slug', 'name']) ?? 'hermes-skill';
    return {
        allowedTools: null,
        configChecks: [],
        description: readString(record, ['description']) ?? null,
        id,
        install: [],
        missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
        name: readString(record, ['name', 'label']) ?? id,
        requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
        runtimeSource: 'hermes',
        source: 'builtin',
        updatedAt: null,
        userInvocable: readBoolean(record, ['enabled']) ?? true,
    };
}

export function mapHermesToolset(value: unknown): AgentRuntimeToolset {
    const record = asRecord(value);
    const name = readString(record, ['name']) ?? 'toolset';
    return {
        configured: readBoolean(record, ['configured']) ?? true,
        description: readString(record, ['description']) ?? null,
        enabled: readBoolean(record, ['enabled']) ?? false,
        id: name,
        label: readString(record, ['label']) ?? name,
        name,
        tools: readStringArray(record.tools),
    };
}

export function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

export function readArray(value: unknown, keys: string[]): unknown[] {
    const record = asRecord(value);
    for (const key of keys) {
        const candidate = record[key];
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }
    return Array.isArray(value) ? value : [];
}

export function readString(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }
    return null;
}

export function readStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];
}

function readNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'boolean') {
            return value;
        }
    }
    return null;
}

function readMessageContent(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => {
                if (typeof item === 'string') {
                    return item;
                }
                const record = asRecord(item);
                return readString(record, ['text', 'content']) ?? '';
            })
            .filter(Boolean)
            .join('\n');
    }
    if (value == null) {
        return '';
    }
    return JSON.stringify(value);
}

function unixSecondsToIso(value: number | null) {
    return value === null ? null : new Date(value * 1000).toISOString();
}

export function truncate(value: string, maxChars: number) {
    return value.length > maxChars ? `${value.slice(0, Math.max(0, maxChars - 1))}…` : value;
}
