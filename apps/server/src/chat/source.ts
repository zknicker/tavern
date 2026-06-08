import type { ChatIdentity } from './shared.ts';

export const chatSourceKinds = [
    'tavern',
    'discord',
    'cron',
    'acp',
    'cli',
    'subagent',
    'internal',
    'hermes',
] as const;

export type ChatSourceKind = (typeof chatSourceKinds)[number];

export interface ChatSource {
    kind: ChatSourceKind;
    label: string;
}

const chatSourceLabels = {
    acp: 'ACP',
    tavern: 'Tavern',
    cli: 'CLI',
    cron: 'Cron',
    discord: 'Discord',
    internal: 'System',
    hermes: 'Hermes',
    subagent: 'Subagent',
} satisfies Record<ChatSourceKind, string>;

const runtimeSessionSources = new Set<ChatSourceKind>([
    'acp',
    'cli',
    'cron',
    'internal',
    'subagent',
]);

export function resolveChatSource(input: {
    identity: ChatIdentity;
    chatId: string | null;
    latestSessionKey: string | null;
    latestSessionPlatform: string | null;
    runtimePlatform: string | null;
}): ChatSource {
    if (input.identity.type === 'tavern') {
        return toChatSource('tavern');
    }

    if (input.identity.type === 'discord') {
        return toChatSource('discord');
    }

    if (isInternalHermesChat(input.identity, input.chatId)) {
        return toChatSource(
            normalizeRuntimeSource(input.runtimePlatform) ??
                normalizeRuntimeSource(input.latestSessionPlatform) ??
                getRuntimeSourceFromSessionKey(input.latestSessionKey) ??
                'internal'
        );
    }

    return toChatSource(normalizeRuntimeSource(input.identity.type) ?? 'hermes');
}

export function isRuntimeSessionSource(source: ChatSource) {
    return runtimeSessionSources.has(source.kind);
}

export function presentRuntimeSessionDisplayName(source: ChatSource) {
    return `${source.label} session`;
}

function toChatSource(kind: ChatSourceKind): ChatSource {
    return {
        kind,
        label: chatSourceLabels[kind],
    };
}

function isInternalHermesChat(identity: ChatIdentity, chatId: string | null) {
    return (
        identity.type === 'hermes' &&
        (identity.target?.startsWith('internal:') || chatId?.startsWith('hermes:internal:'))
    );
}

function normalizeRuntimeSource(value: string | null): ChatSourceKind | null {
    const normalized = value?.trim().toLowerCase();

    switch (normalized) {
        case 'acp':
        case 'cli':
        case 'cron':
        case 'subagent':
            return normalized;
        case 'main':
            return 'internal';
        default:
            return null;
    }
}

function getRuntimeSourceFromSessionKey(sessionKey: string | null): ChatSourceKind | null {
    const parts = sessionKey?.split(':') ?? [];
    const runtime = parts[0] === 'agent' ? (parts[2] ?? null) : null;

    return normalizeRuntimeSource(runtime);
}
