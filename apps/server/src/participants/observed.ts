const discordIdPattern = /\((\d{17,20})\)$/u;

export interface AgentLookupEntry {
    agentId: string;
    displayName: string;
}

export interface AgentLookup {
    byAlias: Map<string, AgentLookupEntry>;
    byDiscordId: Map<string, AgentLookupEntry>;
    byId: Map<string, AgentLookupEntry>;
}

function encodeKeyPart(value: string) {
    return Buffer.from(value, 'utf8').toString('base64url');
}

function normalizeProviderKey(value: string | null) {
    return value && value.length > 0 ? value : 'global';
}

export function extractObservedExternalId(senderLabel: string) {
    return discordIdPattern.exec(senderLabel)?.[1] ?? null;
}

export function normalizeObservedParticipantName(senderLabel: string) {
    const stripped = senderLabel.replace(discordIdPattern, '').trim();

    return stripped.length > 0 ? stripped : senderLabel.trim();
}

export function normalizeObservedParticipantLabel(senderLabel: string) {
    return normalizeActorAlias(normalizeObservedParticipantName(senderLabel));
}

export function normalizeActorAlias(value: string) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/gu, '');

    return normalized.startsWith('the') ? normalized.slice(3) : normalized;
}

export function resolveObservedAgent(senderLabel: string | null, agentLookup: AgentLookup) {
    if (!senderLabel) {
        return null;
    }

    const externalId = extractObservedExternalId(senderLabel);

    if (externalId) {
        const byDiscordId = agentLookup.byDiscordId.get(externalId);

        if (byDiscordId) {
            return byDiscordId;
        }
    }

    return agentLookup.byAlias.get(normalizeObservedParticipantLabel(senderLabel)) ?? null;
}

export function buildParticipantKey(input: {
    accountKey: string | null;
    externalId: string | null;
    normalizedLabel: string | null;
    provider: string;
}) {
    const provider = normalizeProviderKey(input.provider);
    const accountKey = input.externalId ? 'global' : normalizeProviderKey(input.accountKey);
    const keyPart = input.externalId
        ? `external:${input.externalId}`
        : `label:${encodeKeyPart(input.normalizedLabel ?? 'unknown')}`;

    return `participant:${provider}:${accountKey}:${keyPart}`;
}

export function resolveObservedActor(input: {
    accountKey: string | null;
    agentLookup: AgentLookup;
    provider: string;
    senderLabel: string | null;
}) {
    if (!input.senderLabel) {
        return null;
    }

    const agent = resolveObservedAgent(input.senderLabel, input.agentLookup);

    if (agent) {
        return {
            actorType: 'agent' as const,
            agentId: agent.agentId,
            name: agent.displayName,
        };
    }

    const externalId = extractObservedExternalId(input.senderLabel);
    const observedName = normalizeObservedParticipantName(input.senderLabel);
    const normalizedLabel = normalizeObservedParticipantLabel(input.senderLabel);
    const participantId = buildParticipantKey({
        accountKey: input.accountKey,
        externalId,
        normalizedLabel,
        provider: input.provider,
    });

    return {
        actorType: 'participant' as const,
        externalId,
        normalizedLabel,
        observedName,
        participantId,
    };
}
