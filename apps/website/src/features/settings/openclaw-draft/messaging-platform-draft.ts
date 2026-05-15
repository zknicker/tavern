import type {
    BindingDraft,
    DiscordAllowBots,
    DiscordBindingSaveInput,
    DiscordGroupPolicy,
    DiscordReplyToMode,
    DiscordTokenSource,
    MessagingBinding,
} from '../connections/messaging-platform-shared.ts';

type OpenClawConfig = Record<string, unknown>;

const OPENCLAW_REDACTED_SECRET = '__OPENCLAW_REDACTED__';

export function readDiscordBindings(config: OpenClawConfig | null): MessagingBinding[] {
    const discord = readDiscordConfig(config);
    const accounts = readRecord(discord.accounts);
    const bindings = readRecordArray(config?.bindings);

    return bindings.flatMap((binding, index) => {
        const match = readRecord(binding.match);

        if (readString(match.channel) !== 'discord') {
            return [];
        }

        const agentId = readString(binding.agentId);
        const accountId = readString(match.accountId) ?? readString(match.connectionId);

        if (!(agentId && accountId)) {
            return [];
        }

        const account = readDiscordAccount(discord, accounts, accountId);
        const enabled =
            (readBoolean(binding.enabled) ?? readBoolean(account.enabled) ?? true) === true;
        const id = readString(binding.id) ?? buildBindingKey(accountId, agentId, index);
        const allowBots = readDiscordAllowBots(account.allowBots);
        const tokenSource = readDiscordTokenSource(account.token);

        return [
            {
                accountId,
                allowBots,
                agentId,
                enabled,
                groupPolicy:
                    readDiscordGroupPolicy(account.groupPolicy) ??
                    readDiscordGroupPolicy(discord.groupPolicy) ??
                    'allowlist',
                guilds: readDiscordGuilds(account),
                id,
                inboundMode:
                    readInboundMode(binding.inboundMode) ?? readDiscordInboundMode(account),
                match: {
                    channelIds: readDiscordChannelIds(account),
                    dmUserIds: readStringArray(match.dmUserIds),
                    guildIds: readDiscordGuildIds(account),
                    parentChannelIds: readStringArray(match.parentChannelIds),
                },
                mentionPatterns: readAgentMentionPatterns(config, agentId),
                metadata: {
                    allowBots,
                },
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

export function upsertDiscordBinding(
    config: OpenClawConfig,
    input: DiscordBindingSaveInput
): OpenClawConfig {
    const channels = readRecord(config.channels);
    const discord = readRecord(channels.discord);
    const accounts = readRecord(discord.accounts);
    const bindings = readRecordArray(config.bindings);
    const existingIndex = findDiscordBindingIndex(bindings, input.id);
    const existingBinding = existingIndex >= 0 ? bindings[existingIndex] : null;
    const existingMatch = readRecord(existingBinding?.match);
    const previousAccountId =
        readString(existingMatch.accountId) ?? readString(existingMatch.connectionId);
    const accountId =
        input.accountId ||
        previousAccountId ||
        createUniqueAccountId(input.agentId, Object.keys(accounts));
    const nextAccounts = { ...accounts };

    if (previousAccountId && previousAccountId !== accountId) {
        delete nextAccounts[previousAccountId];
    }

    nextAccounts[accountId] = writeDiscordAccount(
        readDiscordAccount(discord, accounts, accountId),
        input
    );

    const nextBinding = {
        ...(existingBinding ?? {}),
        agentId: input.agentId,
        match: {
            ...existingMatch,
            accountId,
            channel: 'discord',
        },
    };
    const nextBindings =
        existingIndex >= 0
            ? bindings.map((binding, index) => (index === existingIndex ? nextBinding : binding))
            : [...bindings, nextBinding];

    return {
        ...config,
        bindings: nextBindings,
        channels: {
            ...channels,
            discord: {
                ...discord,
                accounts: nextAccounts,
            },
        },
        agents: writeAgentMentionPatterns(readRecord(config.agents), input),
    };
}

export function deleteDiscordBinding(config: OpenClawConfig, bindingId: string): OpenClawConfig {
    const channels = readRecord(config.channels);
    const discord = readRecord(channels.discord);
    const accounts = readRecord(discord.accounts);
    const bindings = readRecordArray(config.bindings);
    const removeIndex = findDiscordBindingIndex(bindings, bindingId);

    if (removeIndex < 0) {
        return config;
    }

    const removed = bindings[removeIndex];
    const removedAccountId =
        readString(readRecord(removed.match).accountId) ??
        readString(readRecord(removed.match).connectionId);
    const nextBindings = bindings.filter((_, index) => index !== removeIndex);
    const nextAccounts = { ...accounts };

    if (
        removedAccountId &&
        !nextBindings.some((binding) => {
            const match = readRecord(binding.match);
            return (
                readString(match.channel) === 'discord' &&
                (readString(match.accountId) ?? readString(match.connectionId)) === removedAccountId
            );
        })
    ) {
        delete nextAccounts[removedAccountId];
    }

    return {
        ...config,
        bindings: nextBindings,
        channels: {
            ...channels,
            discord: {
                ...discord,
                accounts: nextAccounts,
            },
        },
    };
}

function writeDiscordAccount(
    account: Record<string, unknown>,
    input: DiscordBindingSaveInput
): Record<string, unknown> {
    const next: Record<string, unknown> = {
        ...account,
        allowBots: input.allowBots,
        enabled: input.enabled,
        groupPolicy: input.groupPolicy,
        name: input.name,
        replyToMode: input.replyToMode,
    };

    if (input.token) {
        next.token = input.token;
    }

    return {
        ...next,
        groupPolicy: input.groupPolicy,
        guilds: Object.fromEntries(
            input.guilds.map((guildDraft) => {
                const guild = readRecord(readRecord(account.guilds)[guildDraft.id]);
                return [
                    guildDraft.id,
                    {
                        ...guild,
                        ignoreOtherMentions: guildDraft.ignoreOtherMentions,
                        requireMention: guildDraft.requireMention,
                        channels: Object.fromEntries(
                            guildDraft.channelIds.map((channelId) => {
                                const channel = readRecord(readRecord(guild.channels)[channelId]);
                                return [
                                    channelId,
                                    {
                                        ...channel,
                                        enabled: true,
                                        requireMention: guildDraft.requireMention,
                                    },
                                ];
                            })
                        ),
                    },
                ];
            })
        ),
    };
}

function writeAgentMentionPatterns(
    agents: Record<string, unknown>,
    input: DiscordBindingSaveInput
) {
    const list = readRecordArray(agents.list);
    const existingIndex = list.findIndex((agent) => readString(agent.id) === input.agentId);
    const existingAgent = existingIndex >= 0 ? list[existingIndex] : {};
    const groupChat = readRecord(existingAgent.groupChat);
    const nextAgent = {
        ...existingAgent,
        groupChat: {
            ...groupChat,
            mentionPatterns: input.mentionPatterns,
        },
        id: input.agentId,
    };
    const nextList =
        existingIndex >= 0
            ? list.map((agent, index) => (index === existingIndex ? nextAgent : agent))
            : [...list, nextAgent];

    return {
        ...agents,
        list: nextList,
    };
}

function readDiscordConfig(config: OpenClawConfig | null) {
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

function readAgentMentionPatterns(config: OpenClawConfig | null, agentId: string) {
    const agents = readRecord(config?.agents);
    const agent = readRecordArray(agents.list).find((entry) => readString(entry.id) === agentId);
    const agentPatterns = readStringArray(readRecord(agent?.groupChat).mentionPatterns);

    if (agentPatterns.length > 0) {
        return agentPatterns;
    }

    return readStringArray(readRecord(readRecord(config?.messages).groupChat).mentionPatterns);
}

function readDiscordAllowBots(value: unknown): DiscordAllowBots {
    return value === true || value === 'mentions' ? value : false;
}

function readDiscordGroupPolicy(value: unknown): DiscordGroupPolicy | null {
    return value === 'open' || value === 'allowlist' || value === 'disabled' ? value : null;
}

function readDiscordReplyToMode(value: unknown): DiscordReplyToMode | null {
    return value === 'off' || value === 'first' || value === 'all' ? value : null;
}

function readDiscordTokenSource(value: unknown): DiscordTokenSource {
    const token = readString(value);

    if (token === OPENCLAW_REDACTED_SECRET) {
        return 'redacted';
    }

    if (token?.trim()) {
        return 'plaintext';
    }

    return isSecretRef(value) ? 'secret-ref' : 'missing';
}

function readDiscordGuilds(account: Record<string, unknown>): BindingDraft['guilds'] {
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

function findDiscordBindingIndex(
    bindings: Record<string, unknown>[],
    bindingId: string | undefined
) {
    return bindings.findIndex((binding, index) => {
        const match = readRecord(binding.match);
        const agentId = readString(binding.agentId);
        const accountId = readString(match.accountId) ?? readString(match.connectionId);

        if (!(agentId && accountId && readString(match.channel) === 'discord')) {
            return false;
        }

        return (readString(binding.id) ?? buildBindingKey(accountId, agentId, index)) === bindingId;
    });
}

function buildBindingKey(accountId: string, agentId: string, index: number) {
    return `discord:${accountId}:${agentId}:${index}`;
}

function createUniqueAccountId(agentId: string, existingIds: string[]) {
    const base = agentId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    let candidate = base || 'discord';
    let suffix = 2;

    while (existingIds.includes(candidate)) {
        candidate = `${base || 'discord'}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

function readDiscordInboundMode(account: Record<string, unknown>): BindingDraft['inboundMode'] {
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

function readInboundMode(value: unknown): BindingDraft['inboundMode'] | null {
    return value === 'active' || value === 'mention-only' || value === 'observe' ? value : null;
}
