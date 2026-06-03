import type {
    AgentRuntimeDeleteDiscordBinding,
    AgentRuntimeOpenClawConfigSnapshot,
    AgentRuntimeSaveDiscordBinding,
    AgentRuntimeUpdateAgentModel,
    AgentRuntimeUpdateAgentName,
    AgentRuntimeUpdateAgentThinkingDefault,
} from '@tavern/api';

type OpenClawConfig = Record<string, unknown>;
type OpenClawConfigUpdater = (config: OpenClawConfig) => OpenClawConfig;

const CONFIG_APPLY_RECONNECT_ATTEMPTS = 8;
const CONFIG_APPLY_RECONNECT_DELAY_MS = 500;
let configMutationQueue: Promise<unknown> = Promise.resolve();

interface OpenClawConfigClient {
    applyOpenClawConfig(input: {
        baseHash: string;
        config: OpenClawConfig;
    }): Promise<AgentRuntimeOpenClawConfigSnapshot>;
    getOpenClawConfig(): Promise<AgentRuntimeOpenClawConfigSnapshot>;
}

export async function applyOpenClawConfigMutation(
    client: OpenClawConfigClient,
    input: {
        update: OpenClawConfigUpdater;
    }
) {
    const mutation = configMutationQueue.then(
        () => applyOpenClawConfigMutationNow(client, input),
        () => applyOpenClawConfigMutationNow(client, input)
    );
    configMutationQueue = mutation.catch(() => undefined);
    return await mutation;
}

async function applyOpenClawConfigMutationNow(
    client: OpenClawConfigClient,
    input: {
        update: OpenClawConfigUpdater;
    }
) {
    const snapshot = await client.getOpenClawConfig();

    try {
        return await client.applyOpenClawConfig({
            baseHash: snapshot.hash,
            config: input.update(snapshot.config),
        });
    } catch (error) {
        if (!isReconnectAfterConfigApply(error)) {
            throw error;
        }

        return await readOpenClawConfigAfterReconnect(client, error);
    }
}

export function updateAgentNameConfig(
    config: OpenClawConfig,
    agentId: string,
    input: AgentRuntimeUpdateAgentName
) {
    return writeAgentEntry(config, agentId, (entry) => ({
        ...entry,
        id: agentId,
        name: input.name,
    }));
}

export function updateAgentModelConfig(
    config: OpenClawConfig,
    agentId: string,
    input: AgentRuntimeUpdateAgentModel
) {
    const modelRef = `${input.model.provider}/${input.model.model}`;

    return writeAgentEntry(config, agentId, (entry) => {
        const models = readRecord(entry.models);
        const modelConfig = readRecord(models[modelRef]);

        return {
            ...entry,
            id: agentId,
            model: {
                ...readRecord(entry.model),
                fallbacks: [],
                primary: modelRef,
            },
            models: {
                ...models,
                [modelRef]: {
                    ...modelConfig,
                    agentRuntime: {
                        ...readRecord(modelConfig.agentRuntime),
                        id: input.model.harness,
                    },
                },
            },
        };
    });
}

export function updateAgentThinkingDefaultConfig(
    config: OpenClawConfig,
    agentId: string,
    input: AgentRuntimeUpdateAgentThinkingDefault
) {
    return writeAgentEntry(config, agentId, (entry) => {
        const { thinkingDefault: _thinkingDefault, ...rest } = entry;
        return input.thinkingDefault
            ? {
                  ...rest,
                  id: agentId,
                  thinkingDefault: input.thinkingDefault,
              }
            : {
                  ...rest,
                  id: agentId,
              };
    });
}

export function upsertDiscordBindingConfig(
    config: OpenClawConfig,
    input: AgentRuntimeSaveDiscordBinding
) {
    const channels = readRecord(config.channels);
    const discord = readRecord(channels.discord);
    const accounts = readRecord(discord.accounts);
    const bindings = readRecordArray(config.bindings);
    const existingIndex = findDiscordBindingIndex(bindings, input.bindingId);
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
        ...pickRouteBindingFields(existingBinding),
        agentId: input.agentId,
        match: {
            ...pickBindingMatchFields(existingMatch),
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
        agents: writeAgentMentionPatterns(readRecord(config.agents), input),
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

export function deleteDiscordBindingConfig(
    config: OpenClawConfig,
    bindingId: string,
    _input: AgentRuntimeDeleteDiscordBinding
) {
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
        readString(readRecord(removed.match).connectionId) ??
        'default';
    const nextBindings = bindings.filter((_, index) => index !== removeIndex);
    const nextAccounts = { ...accounts };

    if (
        removedAccountId &&
        !nextBindings.some((binding) => {
            const match = readRecord(binding.match);
            return (
                readString(match.channel) === 'discord' &&
                (readString(match.accountId) ?? readString(match.connectionId) ?? 'default') ===
                    removedAccountId
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

function writeAgentEntry(
    config: OpenClawConfig,
    agentId: string,
    update: (entry: Record<string, unknown>) => Record<string, unknown>
) {
    const agents = readRecord(config.agents);
    const list = readRecordArray(agents.list);
    const existing = list.find((entry) => readString(entry.id) === agentId);
    const nextEntry = update(existing ?? {});

    return {
        ...config,
        agents: {
            ...agents,
            list: existing
                ? list.map((entry) => (readString(entry.id) === agentId ? nextEntry : entry))
                : [...list, nextEntry],
        },
    };
}

function writeDiscordAccount(
    account: Record<string, unknown>,
    input: AgentRuntimeSaveDiscordBinding
) {
    const tavern = readRecord(account.tavern);
    const next: Record<string, unknown> = {
        ...account,
        allowBots: input.allowBots,
        enabled: input.enabled,
        groupPolicy: input.groupPolicy,
        name: input.name,
        replyToMode: input.replyToMode,
        tavern: {
            ...tavern,
            inboundMode: input.inboundMode,
            match: input.match,
            metadata: input.metadata,
        },
    };

    if (input.token) {
        next.token = input.token;
    }

    return {
        ...next,
        guilds: Object.fromEntries(
            input.guilds.map((guildDraft) => {
                const guild = readRecord(readRecord(account.guilds)[guildDraft.id]);
                return [
                    guildDraft.id,
                    {
                        ...guild,
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
                        ignoreOtherMentions: guildDraft.ignoreOtherMentions,
                        requireMention: guildDraft.requireMention,
                    },
                ];
            })
        ),
    };
}

function writeAgentMentionPatterns(
    agents: Record<string, unknown>,
    input: Pick<AgentRuntimeSaveDiscordBinding, 'agentId' | 'mentionPatterns'>
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

function readDiscordAccount(
    discord: Record<string, unknown>,
    accounts: Record<string, unknown>,
    accountId: string
) {
    return readRecord(accounts[accountId] ?? readRecord(discord.accounts)[accountId]);
}

function findDiscordBindingIndex(bindings: Record<string, unknown>[], bindingId?: string) {
    if (!bindingId) {
        return -1;
    }

    return bindings.findIndex((binding, index) => {
        if (readString(binding.type) === 'acp') {
            return false;
        }

        const match = readRecord(binding.match);
        const accountId =
            readString(match.accountId) ?? readString(match.connectionId) ?? 'default';
        const id =
            readString(binding.id) ??
            buildBindingKey(accountId, readString(binding.agentId) ?? '', index);
        return id === bindingId;
    });
}

function createUniqueAccountId(agentId: string, existingIds: string[]) {
    const base = sanitizeId(agentId) || 'discord';
    let candidate = base;
    let suffix = 2;

    while (existingIds.includes(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

function buildBindingKey(accountId: string, agentId: string, index: number) {
    return `discord:${accountId || 'account'}:${agentId || 'agent'}:${index}`;
}

function pickRouteBindingFields(binding: Record<string, unknown> | null) {
    const next: Record<string, unknown> = {};

    if (readString(binding?.comment)) {
        next.comment = binding?.comment;
    }
    if (readString(binding?.type) === 'route') {
        next.type = 'route';
    }
    const session = pickBindingSessionFields(readRecord(binding?.session));
    if (session) {
        next.session = session;
    }

    return next;
}

function pickBindingMatchFields(match: Record<string, unknown>) {
    const next: Record<string, unknown> = {};

    const peer = pickBindingPeerFields(readRecord(match.peer));
    if (peer) {
        next.peer = peer;
    }
    if (readString(match.guildId)) {
        next.guildId = match.guildId;
    }
    if (readString(match.teamId)) {
        next.teamId = match.teamId;
    }
    if (readStringArray(match.roles).length > 0) {
        next.roles = readStringArray(match.roles);
    }

    return next;
}

function pickBindingSessionFields(session: Record<string, unknown>) {
    const dmScope = readString(session.dmScope);

    if (
        !(
            dmScope === 'main' ||
            dmScope === 'per-peer' ||
            dmScope === 'per-channel-peer' ||
            dmScope === 'per-account-channel-peer'
        )
    ) {
        return null;
    }

    return { dmScope };
}

function pickBindingPeerFields(peer: Record<string, unknown>) {
    const kind = readString(peer.kind);
    const id = readString(peer.id);

    if (!(id && (kind === 'direct' || kind === 'group' || kind === 'channel' || kind === 'dm'))) {
        return null;
    }

    return { id, kind };
}

function sanitizeId(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/gu, '-')
        .replace(/^-+|-+$/gu, '');
}

async function readOpenClawConfigAfterReconnect(
    client: OpenClawConfigClient,
    originalError: unknown
) {
    for (let attempt = 0; attempt < CONFIG_APPLY_RECONNECT_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
            await sleep(CONFIG_APPLY_RECONNECT_DELAY_MS);
        }

        try {
            return await client.getOpenClawConfig();
        } catch {
            // OpenClaw may still be reloading its Gateway after config.apply.
        }
    }

    throw originalError;
}

function isReconnectAfterConfigApply(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLowerCase();
    const errorCode = (error as { code?: unknown }).code;
    const code = typeof errorCode === 'string' ? errorCode.toLowerCase() : '';

    return (
        code.includes('closed') ||
        code.includes('connect') ||
        message.includes('connection closed') ||
        message.includes('gateway connection closed') ||
        message.includes('failed to fetch')
    );
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? (value as Record<string, unknown>) : {};
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? value.map(readRecord) : [];
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readStringArray(value: unknown) {
    return Array.isArray(value) ? value.flatMap((entry) => readString(entry) ?? []) : [];
}
