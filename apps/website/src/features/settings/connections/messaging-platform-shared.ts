import type { AgentOptionItem } from '../../../components/ui/agent-picker.tsx';

export type DiscordAllowBots = false | true | 'mentions';
export type DiscordGroupPolicy = 'open' | 'allowlist' | 'disabled';
export type DiscordReplyToMode = 'off' | 'first' | 'all';
export type DiscordTokenSource = 'missing' | 'plaintext' | 'redacted' | 'secret-ref';

export interface DiscordGuildDraft {
    channelIds: string[];
    draftKey?: string;
    id: string;
    ignoreOtherMentions: boolean;
    requireMention: boolean;
}

export interface BindingDraft {
    accountId: string;
    agentId: string;
    allowBots: DiscordAllowBots;
    dmUserIds: string;
    enabled: boolean;
    groupPolicy: DiscordGroupPolicy;
    guilds: DiscordGuildDraft[];
    id?: string;
    inboundMode: 'active' | 'mention-only' | 'observe';
    mentionPatterns: string;
    metadata: Record<string, unknown>;
    parentChannelIds: string;
    replyToMode: DiscordReplyToMode;
    token: string;
    tokenConfigured: boolean;
    tokenSource: DiscordTokenSource;
}

export interface MessagingBinding {
    accountId: string;
    agentId: string;
    allowBots: DiscordAllowBots;
    enabled: boolean;
    groupPolicy: DiscordGroupPolicy;
    guilds: DiscordGuildDraft[];
    id: string;
    inboundMode: BindingDraft['inboundMode'];
    match: {
        channelIds: string[];
        dmUserIds: string[];
        guildIds: string[];
        parentChannelIds: string[];
    };
    mentionPatterns: string[];
    metadata: Record<string, unknown>;
    name: string;
    platform: 'discord';
    replyToMode: DiscordReplyToMode;
    status: 'configured' | 'disabled' | 'error';
    statusMessage: string | null;
    tokenConfigured: boolean;
    tokenSource: DiscordTokenSource;
}

export type PlatformAgentOption = AgentOptionItem;
export type DiscordBindingSaveInput = ReturnType<typeof buildDiscordBindingSaveInput>;

export function buildEmptyBindingDraft(agentOptions: PlatformAgentOption[]): BindingDraft {
    return {
        accountId: '',
        allowBots: false,
        agentId: agentOptions[0]?.value ?? '',
        dmUserIds: '',
        enabled: true,
        groupPolicy: 'allowlist',
        guilds: [],
        inboundMode: 'active',
        mentionPatterns: '',
        metadata: {},
        parentChannelIds: '',
        replyToMode: 'off',
        token: '',
        tokenConfigured: false,
        tokenSource: 'missing',
    };
}

export function parseCommaSeparatedIds(value: string) {
    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

export function formatCommaSeparatedIds(values: string[]) {
    return values.join(', ');
}

export function buildDiscordBindingName(agentOptions: PlatformAgentOption[], agentId: string) {
    return agentOptions.find((option) => option.value === agentId)?.title?.trim() ?? agentId.trim();
}

export function buildDiscordBindingSaveInput(
    draft: BindingDraft,
    agentOptions: PlatformAgentOption[]
) {
    const { clientId: _clientId, publicKey: _publicKey, ...metadata } = draft.metadata;

    return {
        accountId: draft.accountId.trim(),
        allowBots: draft.allowBots,
        agentId: draft.agentId,
        enabled: draft.enabled,
        groupPolicy: draft.groupPolicy,
        guilds: draft.guilds
            .map((guild) => ({
                channelIds: uniqueStrings(guild.channelIds.map((channelId) => channelId.trim())),
                id: guild.id.trim(),
                ignoreOtherMentions: guild.ignoreOtherMentions,
                requireMention: guild.requireMention,
            }))
            .filter((guild) => guild.id.length > 0),
        id: draft.id,
        inboundMode: draft.inboundMode,
        match: {
            dmUserIds: parseCommaSeparatedIds(draft.dmUserIds),
            parentChannelIds: parseCommaSeparatedIds(draft.parentChannelIds),
        },
        mentionPatterns: parseCommaSeparatedIds(draft.mentionPatterns),
        metadata,
        name: buildDiscordBindingName(agentOptions, draft.agentId),
        platform: 'discord' as const,
        replyToMode: draft.replyToMode,
        token: draft.token.trim() || null,
    };
}

export function formatDiscordBindingInboundMode(mode: BindingDraft['inboundMode']) {
    switch (mode) {
        case 'active':
            return 'All messages';
        case 'mention-only':
            return 'Only mentions or replies';
        case 'observe':
            return 'Observe only';
        default:
            return mode;
    }
}

export function getStatusVariant(status: MessagingBinding['status']) {
    if (status === 'error') {
        return 'error';
    }

    return status === 'disabled' ? 'secondary' : 'success';
}

function uniqueStrings(values: string[]) {
    return [...new Set(values.filter((value) => value.length > 0))];
}
