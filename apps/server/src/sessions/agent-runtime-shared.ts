import type {
    AgentRuntimeSession,
    AgentRuntimeSessionGraph,
    AgentRuntimeSessionMessage,
} from '@tavern/api';
import {
    AgentRuntimeRequestError,
    type TavernAgentRuntimeClient,
} from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';
import { listAgents } from '../agents/catalog.ts';
import { listRuntimeChatRecords, presentRuntimeChatLabel } from '../chat/runtime-chats.ts';
import { buildSessionToolCallsFromMessages } from '../sync/session-tool-call-sync.ts';
import {
    globalSessionListItemSchema,
    globalSessionMetadataSchema,
    type SessionMessage,
    sessionRelationshipSchema,
} from './contracts.ts';
import { getSessionDisplay } from './display.ts';

const selfProfileActorId = 'profile:self';

export interface AgentRuntimeSessionSnapshot {
    agentsById: Map<string, string>;
    chatTitlesById: Map<string, string>;
    graph: AgentRuntimeSessionGraph;
    sessions: AgentRuntimeSession[];
    sessionsByKey: Map<string, AgentRuntimeSession>;
    targetSession: AgentRuntimeSession;
}

export async function findAgentRuntimeSession(id: string) {
    const client = createConfiguredAgentRuntimeClient();

    if (!client) {
        return null;
    }

    try {
        const targetSession = await findRuntimeSession(client, id);

        if (!targetSession) {
            client.close();
            return null;
        }

        return {
            client,
            targetSession,
        };
    } catch (error) {
        client.close();
        throw error;
    }
}

function formatDuration(durationMs: number | null) {
    if (!durationMs || durationMs <= 0) {
        return 'live';
    }

    if (durationMs % 60_000 === 0) {
        return `${durationMs / 60_000}m`;
    }

    if (durationMs % 1000 === 0) {
        return `${durationMs / 1000}s`;
    }

    return `${durationMs}ms`;
}

function resolveDuration(session: AgentRuntimeSession) {
    if (!(session.startedAt && session.lastActivityAt)) {
        return 'live';
    }

    const startedAt = Date.parse(session.startedAt);
    const lastActivityAt = Date.parse(session.lastActivityAt);

    if (Number.isNaN(startedAt) || Number.isNaN(lastActivityAt)) {
        return 'live';
    }

    return formatDuration(Math.max(0, lastActivityAt - startedAt));
}

function buildChatTitleMap(chats: Awaited<ReturnType<typeof listRuntimeChatRecords>>) {
    const chatTitlesById = new Map<string, string>();

    for (const record of chats) {
        chatTitlesById.set(record.chat.id, presentRuntimeChatLabel(record.chat));
    }

    return chatTitlesById;
}

function buildSessionSource(session: AgentRuntimeSession, chatTitlesById: Map<string, string>) {
    return chatTitlesById.get(session.chatId) ?? session.title ?? session.chatId;
}

function compareMessages(left: AgentRuntimeSessionMessage, right: AgentRuntimeSessionMessage) {
    if (left.timestamp !== right.timestamp) {
        return left.timestamp.localeCompare(right.timestamp);
    }

    return left.id.localeCompare(right.id);
}

export function mapAgentRuntimeSessionMessage(
    session: AgentRuntimeSession,
    message: AgentRuntimeSessionMessage
): SessionMessage {
    const agentId = message.senderType === 'agent' ? (message.agentId ?? session.agentId) : null;
    const isTavernSelfMessage =
        message.senderType === 'user' &&
        session.platform === 'tavern' &&
        session.sessionRole === 'main';

    return {
        actor: agentId
            ? { id: agentId, kind: 'agent' as const }
            : isTavernSelfMessage
              ? { id: selfProfileActorId, kind: 'profile' as const }
              : null,
        tavernAgentId: agentId,
        attachments: message.attachments,
        content: message.content,
        id: message.id,
        metadata:
            message.metadata && Object.keys(message.metadata).length > 0
                ? {
                      ...message.metadata,
                      api: message.metadata.api ?? undefined,
                      cacheReadTokens: message.metadata.cacheReadTokens ?? undefined,
                      cacheWriteTokens: message.metadata.cacheWriteTokens ?? undefined,
                      inputTokens: message.metadata.inputTokens ?? undefined,
                      isError: message.metadata.isError ?? undefined,
                      model: message.metadata.model ?? undefined,
                      hermesApi: message.metadata.hermesApi ?? undefined,
                      hermesModel: message.metadata.hermesModel ?? undefined,
                      hermesProvider: message.metadata.hermesProvider ?? undefined,
                      outputTokens: message.metadata.outputTokens ?? undefined,
                      parts: message.metadata.parts ?? undefined,
                      provider: message.metadata.provider ?? undefined,
                      stopReason: message.metadata.stopReason ?? undefined,
                      toolCallId: message.metadata.toolCallId ?? undefined,
                      toolName: message.metadata.toolName ?? undefined,
                      totalTokens: message.metadata.totalTokens ?? undefined,
                      usage: message.metadata.usage ?? undefined,
                  }
                : undefined,
        sender: isTavernSelfMessage ? 'You' : message.senderName,
        senderType: message.senderType,
        timestamp: message.timestamp,
    };
}

export async function loadAgentRuntimeSessionSnapshot(
    id: string
): Promise<AgentRuntimeSessionSnapshot | null> {
    const client = createConfiguredAgentRuntimeClient();

    if (!client) {
        return null;
    }

    try {
        const sessionsResult = await client.listSessions();
        const targetSession = findSessionById(sessionsResult.sessions, id);

        if (!targetSession) {
            return null;
        }

        const [agents, chatRecords, messages] = await Promise.all([
            listAgents(),
            listRuntimeChatRecords(),
            client.listSessionMessages(targetSession.key, { limit: 500 }),
        ]);
        const sessionsByKey = new Map(
            sessionsResult.sessions.map((session) => [session.key, session])
        );
        const graph = {
            artifacts: [],
            links: [],
            messages: messages.messages,
            rootSessionKey: targetSession.key,
            sessions: [targetSession],
            toolCalls: buildSessionToolCallsFromMessages(messages.messages),
        } satisfies AgentRuntimeSessionGraph;

        return {
            agentsById: new Map(agents.map((agent) => [agent.id, agent.name])),
            chatTitlesById: buildChatTitleMap(chatRecords),
            graph,
            sessions: [...sessionsByKey.values()],
            sessionsByKey,
            targetSession,
        };
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return null;
        }

        throw error;
    } finally {
        client.close();
    }
}

export function buildAgentRuntimeSessionListItem(
    session: AgentRuntimeSession,
    chatTitlesById: Map<string, string>
) {
    const source = buildSessionSource(session, chatTitlesById);
    const display = getSessionDisplay({
        source,
        key: session.key,
        title: source,
    });

    return globalSessionListItemSchema.parse({
        agentId: session.agentId,
        duration: resolveDuration(session),
        id: session.sessionId,
        key: session.key,
        messageCount: session.messageCount,
        name: display.name,
        parentSessionKey: session.parentSessionKey ?? null,
        platform: session.platform,
        source: display.source,
        spawnedBy: session.parentSessionKey ?? null,
        startedAt: session.startedAt ?? session.lastActivityAt ?? new Date(0).toISOString(),
        state: 'idle',
        title: display.name,
        type: display.type,
    });
}

export function buildAgentRuntimeSessionMetadata(snapshot: AgentRuntimeSessionSnapshot) {
    const source = buildSessionSource(snapshot.targetSession, snapshot.chatTitlesById);
    const display = getSessionDisplay({
        source,
        key: snapshot.targetSession.key,
        title: source,
    });
    const toolCalls = snapshot.graph.toolCalls.filter(
        (toolCall) => toolCall.sessionKey === snapshot.targetSession.key
    ).length;

    return globalSessionMetadataSchema.parse({
        agentId: snapshot.targetSession.agentId,
        duration: resolveDuration(snapshot.targetSession),
        id: snapshot.targetSession.sessionId,
        invokedBy: null,
        key: snapshot.targetSession.key,
        messageCount: snapshot.targetSession.messageCount,
        name: display.name,
        parentSessionKey: snapshot.targetSession.parentSessionKey ?? null,
        platform: snapshot.targetSession.platform,
        source: display.source,
        spawnedBy: snapshot.targetSession.parentSessionKey ?? null,
        startedAt:
            snapshot.targetSession.startedAt ??
            snapshot.targetSession.lastActivityAt ??
            new Date(0).toISOString(),
        state: 'idle',
        title: display.name,
        toolCalls,
        type: display.type,
    });
}

export function listAgentRuntimeSessionMessages(snapshot: AgentRuntimeSessionSnapshot) {
    return snapshot.graph.messages
        .filter((message) => message.sessionKey === snapshot.targetSession.key)
        .sort(compareMessages)
        .map((message) => mapAgentRuntimeSessionMessage(snapshot.targetSession, message));
}

export function buildAgentRuntimeSessionRelationships(snapshot: AgentRuntimeSessionSnapshot) {
    return snapshot.graph.links
        .filter(
            (link) =>
                link.parentSessionKey === snapshot.targetSession.key ||
                link.childSessionKey === snapshot.targetSession.key
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((link) => {
            const outgoing = link.parentSessionKey === snapshot.targetSession.key;
            const relatedSessionKey = outgoing ? link.childSessionKey : link.parentSessionKey;
            const relatedSession = snapshot.sessionsByKey.get(relatedSessionKey);
            const relatedSource = relatedSession
                ? buildSessionSource(relatedSession, snapshot.chatTitlesById)
                : relatedSessionKey;
            const display = getSessionDisplay({
                source: relatedSource,
                key: relatedSessionKey,
                title: relatedSource,
            });

            return sessionRelationshipSchema.parse({
                direction: outgoing ? 'outgoing' : 'incoming',
                edgeType: 'session_spawns_session',
                id: link.id,
                occurredAt: link.createdAt,
                relatedSession: {
                    agentId: relatedSession?.agentId ?? null,
                    key: relatedSessionKey,
                    name: display.name,
                    platform: relatedSession?.platform ?? null,
                    source: display.source,
                    title: display.name,
                    type: display.type,
                },
                sourceToolCallId: link.sourceToolCallId,
            });
        });
}

async function findRuntimeSession(client: TavernAgentRuntimeClient, id: string) {
    const { sessions } = await client.listSessions();
    return findSessionById(sessions, id);
}

function findSessionById(sessions: AgentRuntimeSession[], id: string) {
    return sessions.find((session) => session.key === id || session.sessionId === id) ?? null;
}
