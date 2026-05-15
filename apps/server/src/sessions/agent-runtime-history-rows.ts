import { buildChatRows } from '../chat/rows.ts';
import {
    type AgentRuntimeSessionSnapshot,
    listAgentRuntimeSessionMessages,
} from './agent-runtime-shared.ts';
import type { SessionHistory } from './contracts.ts';
import { getSessionDisplay } from './display.ts';
import { buildSessionThinking } from './thinking.ts';

function buildWorkerRows(snapshot: AgentRuntimeSessionSnapshot) {
    return snapshot.graph.links
        .filter((link) => link.parentSessionKey === snapshot.targetSession.key)
        .flatMap((link) => {
            const childSession = snapshot.sessionsByKey.get(link.childSessionKey);

            if (!childSession) {
                return [];
            }

            const childMessages = snapshot.graph.messages
                .filter((message) => message.sessionKey === childSession.key)
                .sort((left, right) =>
                    left.timestamp === right.timestamp
                        ? left.id.localeCompare(right.id)
                        : left.timestamp.localeCompare(right.timestamp)
                );
            const terminalSummary =
                [...childMessages].reverse().find((message) => message.content.trim().length > 0)
                    ?.content ?? null;
            const chatTitle =
                snapshot.chatTitlesById.get(childSession.chatId) ?? childSession.title;
            const display = getSessionDisplay({
                key: childSession.key,
                source: chatTitle,
                title: childSession.title,
            });

            return [
                {
                    worker: {
                        agentId: childSession.agentId,
                        agentName:
                            snapshot.agentsById.get(childSession.agentId) ?? childSession.agentId,
                        chatTitle,
                        childSessionKey: childSession.key,
                        cleanupAfter: null,
                        createdAt:
                            childSession.startedAt ?? childSession.lastActivityAt ?? link.createdAt,
                        description: null,
                        detail: terminalSummary,
                        deliveryStatus: null,
                        endedAt: childSession.lastActivityAt,
                        error: null,
                        executionMode: 'detached_session' as const,
                        id: childSession.key,
                        kind: 'cli' as const,
                        lastEventAt: childSession.lastActivityAt,
                        notifyPolicy: null,
                        parentWorkerId: null,
                        progressSummary: null,
                        requesterSessionKey: snapshot.targetSession.key,
                        runId: null,
                        sessionKey: childSession.key,
                        source: 'agentRuntime' as const,
                        sourceFlowId: null,
                        sourceId: childSession.key,
                        startedAt: childSession.startedAt,
                        status:
                            childMessages.length > 0
                                ? ('succeeded' as const)
                                : ('running' as const),
                        syncedAt:
                            childSession.lastActivityAt ??
                            childSession.startedAt ??
                            new Date(0).toISOString(),
                        terminalSummary,
                        title: display.name,
                    },
                },
            ];
        });
}

function getRowTimestamp(row: SessionHistory['rows'][number]) {
    if (row.kind === 'message') {
        return row.message.timestamp;
    }

    if (row.kind === 'tool' || row.kind === 'worker') {
        return row.startedAt ?? row.completedAt ?? new Date(0).toISOString();
    }

    return row.timestamp ?? new Date(0).toISOString();
}

function getRowSessionKey(row: SessionHistory['rows'][number]) {
    if (row.kind === 'message') {
        return row.message.sourceSessionKey;
    }

    if (row.kind === 'tool' || row.kind === 'worker') {
        return row.sessionKey;
    }

    return null;
}

function getRowActorKey(row: SessionHistory['rows'][number]) {
    if (row.kind === 'system') {
        return null;
    }

    return row.actor ? `${row.actor.kind}:${row.actor.id}` : null;
}

export function sortAndAnnotateHistoryRows(rows: SessionHistory['rows']) {
    const sortedRows = [...rows].sort((left, right) => {
        const leftTimestamp = getRowTimestamp(left);
        const rightTimestamp = getRowTimestamp(right);

        if (leftTimestamp !== rightTimestamp) {
            return leftTimestamp.localeCompare(rightTimestamp);
        }

        return left.id.localeCompare(right.id);
    });

    for (let index = 0; index < sortedRows.length; index += 1) {
        const row = sortedRows[index];
        const previous = index > 0 ? sortedRows[index - 1] : null;
        const next = index < sortedRows.length - 1 ? sortedRows[index + 1] : null;
        const rowSessionKey = getRowSessionKey(row);
        const previousSessionKey = previous ? getRowSessionKey(previous) : null;
        const nextSessionKey = next ? getRowSessionKey(next) : null;
        const rowTimestamp = Date.parse(getRowTimestamp(row));
        const previousTimestamp = previous ? Date.parse(getRowTimestamp(previous)) : Number.NaN;
        const nextTimestamp = next ? Date.parse(getRowTimestamp(next)) : Number.NaN;
        const canConnectPrevious =
            row.kind !== 'system' &&
            previous?.kind !== 'system' &&
            rowSessionKey !== null &&
            rowSessionKey === previousSessionKey &&
            Math.abs(rowTimestamp - previousTimestamp) <= 5 * 60_000;
        const canConnectNext =
            row.kind !== 'system' &&
            next?.kind !== 'system' &&
            rowSessionKey !== null &&
            rowSessionKey === nextSessionKey &&
            Math.abs(rowTimestamp - nextTimestamp) <= 5 * 60_000;

        if (row.kind !== 'system') {
            row.connectsToPrevious = canConnectPrevious;
            row.connectsToNext = canConnectNext;
            row.isFirstInGroup =
                getRowActorKey(previous ?? row) !== getRowActorKey(row) || !canConnectPrevious;
        }
    }

    return sortedRows;
}

export function buildAgentRuntimeSessionHistoryRows(snapshot: AgentRuntimeSessionSnapshot) {
    const messages = listAgentRuntimeSessionMessages(snapshot);
    const baseRows = buildChatRows({
        agentLookup: {
            byAlias: new Map(),
            byDiscordId: new Map(),
            byId: new Map(
                [...snapshot.agentsById.entries()].map(([id, displayName]) => [
                    id,
                    {
                        agentId: id,
                        displayName,
                    },
                ])
            ),
        },
        messages: messages.map((message) => ({
            agentId: message.tavernAgentId ?? null,
            message: {
                ...message,
                sourceSessionId: snapshot.targetSession.sessionId ?? null,
                sourceSessionKey: snapshot.targetSession.key,
            },
        })),
        toolCalls: snapshot.graph.toolCalls.filter(
            (toolCall) => toolCall.sessionKey === snapshot.targetSession.key
        ),
        workers: buildWorkerRows(snapshot),
    }) as SessionHistory['rows'];
    const thinkingRows = buildSessionThinking(messages).map((thinking) => ({
        id: thinking.id,
        kind: 'system' as const,
        systemKind: 'thinking' as const,
        thinking,
        timestamp: thinking.timestamp,
    }));
    const artifactRows = snapshot.graph.artifacts
        .filter((artifact) => artifact.sessionKey === snapshot.targetSession.key)
        .map((artifact) => ({
            artifact: {
                artifactType: artifact.artifactType,
                createdAt: artifact.createdAt,
                id: artifact.id,
                mimeType: artifact.mimeType,
                path: artifact.path,
                payload: artifact.payload,
            },
            id: artifact.id,
            kind: 'system' as const,
            systemKind: 'artifact' as const,
            timestamp: artifact.createdAt,
        }));

    return [...baseRows, ...thinkingRows, ...artifactRows];
}
