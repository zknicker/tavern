import type { AgentRuntimeChatParticipant } from '@tavern/api';

type DiscordObservedParticipant = Extract<AgentRuntimeChatParticipant, { type: 'participant' }>;

function encodeKeyPart(value: string) {
    return Buffer.from(value, 'utf8').toString('base64url');
}

function normalizeLabel(value: string) {
    return value
        .replace(/\s+user\s+id:\d{17,20}$/iu, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '');
}

export function extractDiscordUserId(value: string) {
    const match = /^(?:user:)?(\d{17,20})$/u.exec(value.trim());

    return match?.[1] ?? null;
}

export function buildDiscordParticipant(input: {
    label: string | null;
    observedLabels?: string[];
    targetId: string;
}): DiscordObservedParticipant | null {
    const externalId = extractDiscordUserId(input.targetId);

    if (!externalId) {
        return null;
    }

    const name =
        input.label?.replace(new RegExp(`\\s+user\\s+id:${externalId}$`, 'iu'), '').trim() ||
        `Discord user ${externalId}`;
    const normalizedLabel = normalizeLabel(name) || externalId;
    const keyPart = externalId
        ? `external:${externalId}`
        : `label:${encodeKeyPart(normalizedLabel)}`;

    return {
        accountKey: null,
        externalId,
        name,
        observedLabels: uniqueStrings([name, ...(input.observedLabels ?? [])]),
        participantId: `participant:discord:global:${keyPart}`,
        platform: 'discord',
        type: 'participant',
    };
}

function uniqueStrings(values: string[]) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}
