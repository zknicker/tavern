import type { AgentRuntimeDiscordBinding } from '@tavern/api';

type HermesConfig = Record<string, unknown>;
type DiscordGroupPolicy = AgentRuntimeDiscordBinding['groupPolicy'];
type DiscordInboundMode = AgentRuntimeDiscordBinding['inboundMode'];
type DiscordReplyToMode = AgentRuntimeDiscordBinding['replyToMode'];

const HERMES_REDACTED_SECRET = '__HERMES_REDACTED__';

export function readHermesDiscordBindings(
    config: HermesConfig | null
): AgentRuntimeDiscordBinding[] {
    const discord = readDiscordConfig(config);
    const accounts = readRecord(discord.accounts);
    const bindings = readRecordArray(config?.bindings);

    return bindings.flatMap((binding, index) => {
        const match = readRecord(binding.match);

        if (readString(match.channel) !== 'discord' || readString(binding.type) === 'acp') {
            return [];
        }

        const agentId = readString(binding.agentId);
        const accountId =
            readString(match.accountId) ?? readString(match.connectionId) ?? 'default';

        if (!agentId) {
            return [];
        }

        const account = readDiscordAccount(discord, accounts, accountId);
        const tavern = readRecord(account.tavern);
        const tavernMatch = readRecord(tavern.match);
        const enabled =
            (readBoolean(binding.enabled) ?? readBoolean(account.enabled) ?? true) === true;
        const id = readString(binding.id) ?? buildBindingKey(accountId, agentId, index);
        const allowBots = readDiscordAllowBots(account.allowBots);
        const tokenSource = readDiscordTokenSource(account.token);
        const dmUserIds = readStringArray(tavernMatch.dmUserIds);
        const parentChannelIds = readStringArray(tavernMatch.parentChannelIds);
        const metadata = readRecord(tavern.metadata);

        return [
            {
                accountId,
                agentId,
                allowBots,
                enabled,
                groupPolicy:
                    readDiscordGroupPolicy(account.groupPolicy) ??
                    readDiscordGroupPolicy(discord.groupPolicy) ??
                    'allowlist',
                guilds: readDiscordGuilds(account),
                id,
                inboundMode:
                    readInboundMode(tavern.inboundMode) ??
                    readInboundMode(binding.inboundMode) ??
                    readDiscordInboundMode(account),
                match: {
                    channelIds: readDiscordChannelIds(account),
                    dmUserIds: dmUserIds.length > 0 ? dmUserIds : readStringArray(match.dmUserIds),
                    guildIds: readDiscordGuildIds(account),
                    parentChannelIds:
                        parentChannelIds.length > 0
                            ? parentChannelIds
                            : readStringArray(match.parentChannelIds),
                },
                mentionPatterns: readAgentMentionPatterns(config, agentId),
                metadata:
                    Object.keys(metadata).length > 0 ? metadata : readRecord(binding.metadata),
                name: readString(account.name) ?? readString(binding.name) ?? agentId,
                platform: 'discord',
                replyToMode: readDiscordReplyToMode(account.replyToMode) ?? 'off',
                status: enabled ? 'configured' : 'disabled',
                statusMessage: null,
                tokenConfigured: tokenSource !== 'missing',
                tokenSource,
            },
        ];
    });
}

function readDiscordConfig(config: HermesConfig | null) {
    return readRecord(readRecord(config?.channels).discord);
}

function readDiscordAccount(
    discord: Record<string, unknown>,
    accounts: Record<string, unknown>,
    accountId: string
) {
    const account = readRecord(accounts[accountId]);

    if (accountId !== 'default') {
        return account;
    }

    const { accounts: _accounts, ...defaults } = discord;

    return {
        ...defaults,
        ...account,
    };
}

function readAgentMentionPatterns(config: HermesConfig | null, agentId: string) {
    const agents = readRecord(config?.agents);
    const agent = readRecordArray(agents.list).find((entry) => readString(entry.id) === agentId);
    const agentPatterns = readStringArray(readRecord(agent?.groupChat).mentionPatterns);

    return agentPatterns.length > 0
        ? agentPatterns
        : readStringArray(readRecord(readRecord(config?.messages).groupChat).mentionPatterns);
}

function readDiscordAllowBots(value: unknown): AgentRuntimeDiscordBinding['allowBots'] {
    return value === true || value === 'mentions' ? value : false;
}

function readDiscordGroupPolicy(value: unknown): DiscordGroupPolicy | null {
    return value === 'open' || value === 'allowlist' || value === 'disabled' ? value : null;
}

function readDiscordReplyToMode(value: unknown): DiscordReplyToMode | null {
    return value === 'off' || value === 'first' || value === 'all' ? value : null;
}

function readDiscordTokenSource(value: unknown) {
    const token = readString(value);

    if (token === HERMES_REDACTED_SECRET) {
        return 'redacted' as const;
    }

    if (token?.trim()) {
        return 'plaintext' as const;
    }

    return isSecretRef(value) ? ('secret-ref' as const) : ('missing' as const);
}

function readDiscordGuilds(account: Record<string, unknown>) {
    return Object.entries(readRecord(account.guilds)).map(([id, value]) => {
        const guild = readRecord(value);
        return {
            channelIds: Object.keys(readRecord(guild.channels)),
            id,
            ignoreOtherMentions: readBoolean(guild.ignoreOtherMentions) ?? true,
            requireMention: readBoolean(guild.requireMention) ?? true,
        };
    });
}

function isSecretRef(value: unknown) {
    const record = readRecord(value);
    const source = readString(record.source);

    return (
        (source === 'env' || source === 'file' || source === 'exec') &&
        Boolean(readString(record.provider)) &&
        Boolean(readString(record.id))
    );
}

function readDiscordMentionBooleans(account: Record<string, unknown>, key: string) {
    return readRecordArrayValues(readRecord(account.guilds))
        .flatMap((guild) => [
            readBoolean(guild[key]),
            ...readRecordArrayValues(readRecord(guild.channels)).map((channel) =>
                readBoolean(channel[key])
            ),
        ])
        .filter((value): value is boolean => typeof value === 'boolean');
}

function buildBindingKey(accountId: string, agentId: string, index: number) {
    return `discord:${accountId}:${agentId}:${index}`;
}

function readDiscordInboundMode(account: Record<string, unknown>): DiscordInboundMode {
    const requireMentionValues = readDiscordMentionBooleans(account, 'requireMention');

    return requireMentionValues.length > 0 && requireMentionValues.every(Boolean)
        ? 'mention-only'
        : 'active';
}

function readDiscordGuildIds(account: Record<string, unknown>) {
    return Object.keys(readRecord(account.guilds));
}

function readDiscordChannelIds(account: Record<string, unknown>) {
    return readRecordArrayValues(readRecord(account.guilds)).flatMap((guild) =>
        Object.keys(readRecord(guild.channels))
    );
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? value.map(readRecord) : [];
}

function readRecordArrayValues(value: Record<string, unknown>) {
    return Object.values(value).map(readRecord);
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readStringArray(value: unknown) {
    return Array.isArray(value) ? value.flatMap((entry) => readString(entry) ?? []) : [];
}

function readBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : null;
}

function readInboundMode(value: unknown): DiscordInboundMode | null {
    return value === 'active' || value === 'mention-only' || value === 'observe' ? value : null;
}
