import {
    type AgentRuntimeSession,
    type AgentRuntimeSessionGraph,
    type AgentRuntimeSessionMessage,
    agentRuntimeModelProviderIdSchema,
} from '@tavern/api';
import { inArray, or } from 'drizzle-orm';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { listAgents } from '../agents/catalog.ts';
import { listRuntimeChatRecords, presentRuntimeChatLabel } from '../chat/runtime-chats.ts';
import { db } from '../db/index.ts';
import { sessionArtifactsTable, sessionLinksTable } from '../db/schema.ts';
import { selfProfileId } from '../participants/self.ts';
import { getAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import { listSessionMessagesForSessionKeys } from '../storage/session-messages.ts';
import { listSessionToolCalls } from '../storage/session-tool-calls.ts';
import {
    getSessionRecord,
    listSessionRecords,
    parseSessionRecord,
    parseSessionRuntimePayload,
} from '../storage/sessions.ts';
import {
    globalSessionListItemSchema,
    globalSessionMetadataSchema,
    type SessionMessage,
    sessionRelationshipSchema,
} from './contracts.ts';
import { getSessionDisplay } from './display.ts';

export interface AgentRuntimeSessionSnapshot {
    agentsById: Map<string, string>;
    chatTitlesById: Map<string, string>;
    graph: AgentRuntimeSessionGraph;
    sessions: AgentRuntimeSession[];
    sessionsByKey: Map<string, AgentRuntimeSession>;
    targetSession: AgentRuntimeSession;
}

export async function findAgentRuntimeSession(id: string) {
    const sessionRecord = await getSessionRecord(id);

    if (sessionRecord?.runtime) {
        const runtime = await getAgentRuntimeConnection(sessionRecord.runtime);
        const runtimeSession = parseSessionRuntimePayload(sessionRecord);

        if (runtime && runtimeSession) {
            return {
                client: createAgentRuntimeClientForConnection(runtime),
                runtimeId: runtime.id,
                targetSession: runtimeSession,
            };
        }
    }

    return null;
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
              ? { id: selfProfileId, kind: 'profile' as const }
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
                      openClawApi: message.metadata.openClawApi ?? undefined,
                      openClawHarness: message.metadata.openClawHarness ?? undefined,
                      openClawModel: message.metadata.openClawModel ?? undefined,
                      openClawProvider: message.metadata.openClawProvider ?? undefined,
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
    const storedSnapshot = await loadSessionSnapshotFromRecords(id);

    if (storedSnapshot) {
        return storedSnapshot;
    }

    return null;
}

async function loadSessionSnapshotFromRecords(
    id: string
): Promise<AgentRuntimeSessionSnapshot | null> {
    const sessionRecord = await getSessionRecord(id);

    if (!sessionRecord) {
        return null;
    }

    const targetSession = parseSessionRecord(sessionRecord);

    if (!targetSession) {
        return null;
    }

    const [agents, chatRecords, sessionRecords] = await Promise.all([
        listAgents(),
        listRuntimeChatRecords(),
        listSessionRecords(),
    ]);
    const sessions = sessionRecords.flatMap((record) => {
        const session = parseSessionRecord(record);
        return session ? [session] : [];
    });
    const links = await listSessionLinks([targetSession.key]);
    const graphSessionKeys = [
        ...new Set([
            targetSession.key,
            ...links.flatMap((link) => [link.childSessionKey, link.parentSessionKey]),
        ]),
    ];
    const [messages, toolCalls, artifacts] = await Promise.all([
        listSessionMessagesForSessionKeys(graphSessionKeys),
        listSessionToolCalls(graphSessionKeys),
        listSessionArtifacts(graphSessionKeys),
    ]);

    return {
        agentsById: new Map(agents.map((agent) => [agent.id, agent.name])),
        chatTitlesById: buildChatTitleMap(chatRecords),
        graph: {
            artifacts,
            links,
            messages: messages.map((message) =>
                mapSessionMessageRecord({
                    message,
                    session: targetSession,
                })
            ),
            rootSessionKey: targetSession.key,
            sessions,
            toolCalls,
        },
        sessions,
        sessionsByKey: new Map(sessions.map((session) => [session.key, session])),
        targetSession,
    };
}

async function listSessionLinks(sessionKeys: string[]) {
    if (sessionKeys.length === 0) {
        return [];
    }

    const rows = await db
        .select()
        .from(sessionLinksTable)
        .where(
            or(
                inArray(sessionLinksTable.parentSessionKey, sessionKeys),
                inArray(sessionLinksTable.childSessionKey, sessionKeys)
            )
        );

    return rows.map((row) => ({
        childSessionKey: row.childSessionKey,
        createdAt: row.createdAt,
        id: row.id,
        linkType: row.linkType,
        parentSessionKey: row.parentSessionKey,
        sourceToolCallId: row.sourceToolCallId,
    }));
}

async function listSessionArtifacts(sessionKeys: string[]) {
    if (sessionKeys.length === 0) {
        return [];
    }

    const rows = await db
        .select()
        .from(sessionArtifactsTable)
        .where(inArray(sessionArtifactsTable.sessionKey, sessionKeys));

    return rows.map((row) => ({
        artifactType: row.artifactType,
        createdAt: row.createdAt,
        id: row.id,
        messageId: row.messageId,
        mimeType: row.mimeType,
        path: row.path,
        payload: parseJson(row.payloadJson),
        runId: row.runId,
        sessionKey: row.sessionKey,
        toolCallId: row.toolCallId,
    }));
}

function mapSessionMessageRecord(input: {
    message: Awaited<ReturnType<typeof listSessionMessagesForSessionKeys>>[number];
    session: AgentRuntimeSession;
}): AgentRuntimeSessionMessage {
    const raw = parseSessionMessageRaw(input.message.rawJson);
    const modelInfo = resolveSessionMessageModelInfo(input.message, raw);
    const metadata: NonNullable<AgentRuntimeSessionMessage['metadata']> = {
        ...(raw?.metadata ?? {}),
        api: input.message.api ?? raw?.metadata?.api ?? undefined,
        model: modelInfo?.model ?? raw?.metadata?.model ?? undefined,
        openClawApi: input.message.openClawApi ?? raw?.metadata?.openClawApi ?? undefined,
        openClawHarness: resolveOpenClawHarness(
            input.message.openClawHarness ?? raw?.metadata?.openClawHarness
        ),
        openClawModel: input.message.openClawModel ?? raw?.metadata?.openClawModel ?? undefined,
        openClawProvider:
            input.message.openClawProvider ?? raw?.metadata?.openClawProvider ?? undefined,
        provider: modelInfo?.provider ?? raw?.metadata?.provider ?? undefined,
        stopReason: input.message.stopReason ?? raw?.metadata?.stopReason ?? undefined,
        usage: parseJson(input.message.usageJson) ?? raw?.metadata?.usage,
    };
    const senderType = resolveSessionMessageSenderType(input.message.role);

    return {
        agentId:
            input.message.actorKind === 'agent' ? input.message.actorId : (raw?.agentId ?? null),
        attachments: raw?.attachments,
        chatId: input.session.chatId,
        content: input.message.contentText ?? raw?.content ?? '',
        id: input.message.id,
        metadata: Object.values(metadata).some((value) => typeof value !== 'undefined')
            ? metadata
            : null,
        participant: raw?.participant,
        sender: input.message.senderLabel ?? raw?.sender ?? senderType,
        senderName: input.message.senderLabel ?? raw?.senderName ?? raw?.sender ?? senderType,
        senderType,
        sessionKey: input.message.sessionKey,
        timestamp: input.message.timestamp ?? input.message.syncedAt,
    };
}

function parseSessionMessageRaw(rawJson: string) {
    const parsed = parseJson(rawJson);

    if (!(parsed && typeof parsed === 'object' && !Array.isArray(parsed))) {
        return null;
    }

    return parsed as Partial<AgentRuntimeSessionMessage>;
}

function resolveOpenClawHarness(value: unknown) {
    return value === 'pi' || value === 'codex' ? value : undefined;
}

function parseJson(value: string | null) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}

function resolveSessionMessageSenderType(role: string): AgentRuntimeSessionMessage['senderType'] {
    if (role === 'agent' || role === 'system' || role === 'user') {
        return role;
    }

    return 'system';
}

function resolveSessionMessageModelInfo(
    message: Awaited<ReturnType<typeof listSessionMessagesForSessionKeys>>[number],
    raw: Partial<AgentRuntimeSessionMessage> | null
) {
    const provider = message.provider ?? raw?.metadata?.provider ?? null;
    const model = message.model ?? raw?.metadata?.model ?? null;

    if (!(provider && model)) {
        return null;
    }

    const parsedProvider = agentRuntimeModelProviderIdSchema.safeParse(provider);

    if (!parsedProvider.success) {
        return null;
    }

    return {
        model,
        provider: parsedProvider.data,
    };
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
