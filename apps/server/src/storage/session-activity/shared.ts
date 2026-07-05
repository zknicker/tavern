import { asc, inArray } from 'drizzle-orm';
import { listAgents } from '../../agents/catalog.ts';
import { db } from '../../db/index.ts';
import {
    sessionMessagePartsTable,
    type sessionMessagesTable,
    type sessionToolCallsTable,
} from '../../db/schema.ts';
import { normalizeModelIdentity } from '../../model/identity.ts';
import {
    type AgentLookup,
    normalizeActorAlias,
    normalizeObservedParticipantName,
    resolveObservedAgent,
} from '../../participants/observed.ts';
import { sessionMessageSchema } from '../../sessions/contracts.ts';
import { listRuntimeSessions } from '../../sessions/runtime-sessions.ts';

export function parseJson(value: string | null) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as unknown;
    } catch {
        return value;
    }
}

export function getString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function resolveSenderType(role: string, senderLabel: string | null, agentLookup: AgentLookup) {
    if (role === 'assistant') {
        return 'agent' as const;
    }

    if (role === 'user' && senderLabel) {
        if (resolveObservedAgent(senderLabel, agentLookup)) {
            return 'agent' as const;
        }

        return 'user' as const;
    }

    return 'system' as const;
}

function resolveActorRef(record: typeof sessionMessagesTable.$inferSelect) {
    if (
        (record.actorKind === 'agent' ||
            record.actorKind === 'participant' ||
            record.actorKind === 'profile') &&
        typeof record.actorId === 'string' &&
        record.actorId.trim().length > 0
    ) {
        return {
            id: record.actorId,
            kind: record.actorKind,
        } as const;
    }

    if (record.role === 'assistant') {
        const agentId = deriveSessionAgentId(record.sessionKey);

        return agentId
            ? ({
                  id: agentId,
                  kind: 'agent',
              } as const)
            : null;
    }

    return null;
}

function resolveMessageSenderType(input: {
    actor: ReturnType<typeof resolveActorRef>;
    agentLookup: AgentLookup;
    record: typeof sessionMessagesTable.$inferSelect;
}) {
    if (input.record.role === 'assistant') {
        return 'agent' as const;
    }

    if (input.actor?.kind === 'agent') {
        return 'agent' as const;
    }

    if (input.actor?.kind === 'participant') {
        return 'user' as const;
    }

    return resolveSenderType(input.record.role, input.record.senderLabel, input.agentLookup);
}

function resolveMessageSenderName(input: {
    actor: ReturnType<typeof resolveActorRef>;
    agentLookup: AgentLookup;
    record: typeof sessionMessagesTable.$inferSelect;
}) {
    if (input.actor?.kind === 'agent') {
        return (
            input.agentLookup.byId.get(input.actor.id)?.displayName ??
            input.record.senderLabel ??
            'agent'
        );
    }

    if (input.record.role === 'user' && input.record.senderLabel) {
        return normalizeObservedParticipantName(input.record.senderLabel);
    }

    return (
        input.record.senderLabel || (input.record.role === 'user' ? 'system' : input.record.role)
    );
}

export async function loadAgentLookup(): Promise<AgentLookup> {
    const agents = await listAgents();

    const byAlias = new Map<string, { entry: (typeof agents)[number]; count: number }>();
    const byDiscordId = new Map<string, { agentId: string; displayName: string }>();

    for (const agent of agents) {
        const aliases = new Set(
            [agent.name]
                .map((value) => (value ? normalizeActorAlias(value) : null))
                .filter((value): value is string => Boolean(value))
        );

        for (const alias of aliases) {
            const existing = byAlias.get(alias);

            if (existing) {
                existing.count += 1;
                continue;
            }

            byAlias.set(alias, {
                count: 1,
                entry: agent,
            });
        }
    }

    return {
        byAlias: new Map(
            [...byAlias.entries()]
                .filter(([, value]) => value.count === 1)
                .map(([key, value]) => [
                    key,
                    {
                        agentId: value.entry.id,
                        displayName: value.entry.name,
                    },
                ])
        ),
        byDiscordId,
        byId: new Map(
            agents.map((agent) => [
                agent.id,
                {
                    agentId: agent.id,
                    displayName: agent.name,
                },
            ])
        ),
    };
}

export function resolveDeliveryMessageText(payload: unknown) {
    if (typeof payload === 'string') {
        return payload.trim();
    }

    if (!(payload && typeof payload === 'object' && !Array.isArray(payload))) {
        return null;
    }

    const record = payload as Record<string, unknown>;

    for (const key of ['text', 'message']) {
        const candidate = record[key];
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
    }

    return null;
}

export function deriveSessionAgentId(sessionKey: string) {
    const match = /^agent:([^:]+):/.exec(sessionKey);
    return match?.[1] ?? null;
}

function parseJsonString(value: string | null) {
    if (!value) {
        return undefined;
    }

    try {
        return JSON.parse(value) as unknown;
    } catch {
        return undefined;
    }
}

export function findSessionKeyInPayload(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim();

        if (trimmed.startsWith('agent:')) {
            return trimmed;
        }

        const parsed = parseJsonString(trimmed);

        return typeof parsed === 'undefined' ? null : findSessionKeyInPayload(parsed);
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = findSessionKeyInPayload(item);

            if (nested) {
                return nested;
            }
        }

        return null;
    }

    if (!(value && typeof value === 'object')) {
        return null;
    }

    const record = value as Record<string, unknown>;

    for (const key of ['childSessionKey', 'sessionKey', 'targetSessionKey']) {
        const nested = findSessionKeyInPayload(record[key]);

        if (nested) {
            return nested;
        }
    }

    for (const nestedValue of Object.values(record)) {
        const nested = findSessionKeyInPayload(nestedValue);

        if (nested) {
            return nested;
        }
    }

    return null;
}

export function resolveSpawnedChildSessionKey(record: typeof sessionToolCallsTable.$inferSelect) {
    if (record.childSessionKey) {
        return record.childSessionKey;
    }

    const resultKey = findSessionKeyInPayload(parseJson(record.resultJson));

    if (resultKey) {
        return resultKey;
    }

    return findSessionKeyInPayload(parseJson(record.argumentsJson));
}

export async function buildSessionReferenceLookup(sessionKeys: string[]) {
    const uniqueKeys = [...new Set(sessionKeys)];

    if (uniqueKeys.length === 0) {
        return new Map<string, { agentId: string | null; channel: string | null; title: string }>();
    }

    const agentRuntimeSessions = await listRuntimeSessions();
    const relatedSessionByKey = new Map(
        agentRuntimeSessions
            .filter((session) => uniqueKeys.includes(session.key))
            .map((session) => [session.key, session] as const)
    );
    return new Map(
        uniqueKeys.map((key) => {
            const cached = relatedSessionByKey.get(key);

            return [
                key,
                {
                    agentId: cached?.agentId ?? deriveSessionAgentId(key),
                    channel: cached?.title ?? null,
                    title: cached?.title ?? key,
                },
            ];
        })
    );
}

export function mapSessionActivityMessage(
    record: typeof sessionMessagesTable.$inferSelect,
    parts: (typeof sessionMessagePartsTable.$inferSelect)[],
    includeParts: boolean,
    agentLookup: AgentLookup
) {
    const raw = parseJson(record.rawJson);
    const partPayloads = includeParts ? parts.map((part) => parseJson(part.rawJson)) : undefined;
    const firstToolPart = parts.find((part) => part.toolCallId || part.toolName);
    const rawToolMetadata =
        raw && typeof raw === 'object' && !Array.isArray(raw)
            ? (raw as { toolCallId?: unknown; toolName?: unknown })
            : null;
    const actor = resolveActorRef(record);
    const tavernAgentId = actor?.kind === 'agent' ? actor.id : null;
    const modelInfo = normalizeModelIdentity({
        model: record.model,
        provider: record.provider,
    });

    return sessionMessageSchema.parse({
        tavernAgentId,
        actor,
        content: record.contentText ?? '',
        id: record.id,
        metadata: {
            api: record.api ?? undefined,
            isError:
                typeof (raw as { isError?: unknown } | null)?.isError === 'boolean'
                    ? (raw as { isError: boolean }).isError
                    : undefined,
            model: modelInfo?.model,
            modelInfo,
            parts: partPayloads,
            provider: modelInfo?.provider,
            stopReason: record.stopReason ?? undefined,
            toolCallId:
                firstToolPart?.toolCallId ??
                (typeof rawToolMetadata?.toolCallId === 'string'
                    ? rawToolMetadata.toolCallId
                    : undefined),
            toolName:
                firstToolPart?.toolName ??
                (typeof rawToolMetadata?.toolName === 'string'
                    ? rawToolMetadata.toolName
                    : undefined),
            usage: parseJson(record.usageJson),
        },
        sender: resolveMessageSenderName({
            actor,
            agentLookup,
            record,
        }),
        senderType: resolveMessageSenderType({
            actor,
            agentLookup,
            record,
        }),
        timestamp: record.timestamp ?? new Date(0).toISOString(),
    });
}

export function listSessionActivityMessageParts(messageIds: string[]) {
    if (messageIds.length === 0) {
        return [];
    }

    return db
        .select()
        .from(sessionMessagePartsTable)
        .where(inArray(sessionMessagePartsTable.messageId, messageIds))
        .orderBy(asc(sessionMessagePartsTable.messageId), asc(sessionMessagePartsTable.partIndex));
}
