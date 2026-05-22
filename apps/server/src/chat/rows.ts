import type { AgentRuntimeSessionGraph } from '@tavern/api';
import type { ActorRef } from '../actors/contracts.ts';
import { getMessageActor, toAgentActor } from '../actors/resolve.ts';
import type { AgentLookup } from '../participants/observed.ts';
import type { SessionMessage } from '../sessions/contracts.ts';
import { mergeToolCalls } from '../sessions/tool-call-sync.ts';
import { buildSessionThinking } from '../sessions/thinking.ts';
import { buildToolSummary, buildToolSummaryFromValues } from '../tools/summary.ts';
import type { Worker } from '../workers/contracts.ts';
import type { ChatLogPage } from './contracts.ts';

type ChatToolCallCandidate = AgentRuntimeSessionGraph['toolCalls'][number];

interface ChatRowMessage extends SessionMessage {
    sourceSessionId: string | null;
    sourceSessionKey: string;
}

export interface ChatRowCandidate {
    agentId: string | null;
    message: ChatRowMessage;
}

export interface ChatWorkerCandidate {
    worker: Worker;
}

const sessionRailMaxGapMs = 5 * 60 * 1000;

function normalizeAgentMessage(
    message: ChatRowMessage,
    agentLookup: AgentLookup,
    agentId: string | null
) {
    if (
        message.senderType === 'agent' &&
        agentId &&
        (message.sender === 'agent' || message.sender === 'assistant')
    ) {
        return {
            ...message,
            sender: agentLookup.byId.get(agentId)?.displayName ?? message.sender,
        };
    }

    return message;
}

function getToolCallId(message: ChatRowMessage) {
    return message.metadata?.toolCallId ?? null;
}

function getRowTimestamp(row: ChatLogPage['rows'][number]) {
    const timestamp =
        row.kind === 'message'
            ? row.message.timestamp
            : row.kind === 'worker'
              ? (row.startedAt ?? row.completedAt ?? row.worker.lastEventAt ?? row.worker.createdAt)
              : row.kind === 'tool'
                ? (row.startedAt ?? row.completedAt)
                : row.timestamp;
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function getRowSessionKey(row: ChatLogPage['rows'][number]) {
    if (row.kind === 'message') {
        const sessionKey = row.message.sourceSessionKey.trim();
        return sessionKey.length > 0 ? sessionKey : null;
    }

    if (row.kind === 'tool') {
        return row.sessionKey;
    }

    if (row.kind === 'worker') {
        return row.sessionKey ?? row.worker.sessionKey;
    }

    return null;
}

function canConnectSessionRail(
    currentRow: ChatLogPage['rows'][number],
    adjacentRow: ChatLogPage['rows'][number] | null
) {
    const currentSessionKey = getRowSessionKey(currentRow);
    const adjacentSessionKey = adjacentRow ? getRowSessionKey(adjacentRow) : null;

    if (!currentSessionKey || currentSessionKey !== adjacentSessionKey) {
        return false;
    }

    const currentTimestamp = getRowTimestamp(currentRow);
    const adjacentTimestamp = adjacentRow ? getRowTimestamp(adjacentRow) : null;

    if (currentTimestamp === null || adjacentTimestamp === null) {
        return false;
    }

    return Math.abs(currentTimestamp - adjacentTimestamp) <= sessionRailMaxGapMs;
}

function getActorKey(actor: ActorRef | null) {
    return actor ? `${actor.kind}:${actor.id}` : null;
}

function annotateRows(rows: ChatLogPage['rows']) {
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const previousRow = index > 0 ? rows[index - 1] : null;
        const nextRow = index < rows.length - 1 ? rows[index + 1] : null;

        if (row.kind === 'system') {
            continue;
        }

        row.connectsToPrevious = canConnectSessionRail(row, previousRow);
        row.connectsToNext = canConnectSessionRail(row, nextRow);
        const previousActorKey =
            previousRow && previousRow.kind !== 'system' ? getActorKey(previousRow.actor) : null;
        row.isFirstInGroup = row.actor === null || previousActorKey !== getActorKey(row.actor);
    }

    return rows;
}

export function buildChatRows(input: {
    agentLookup: AgentLookup;
    messages: ChatRowCandidate[];
    toolCalls: ChatToolCallCandidate[];
    workers: ChatWorkerCandidate[];
}): ChatLogPage['rows'] {
    const rows: ChatLogPage['rows'] = [];
    const messages = input.messages.map((candidate) => ({
        ...candidate,
        message: normalizeAgentMessage(candidate.message, input.agentLookup, candidate.agentId),
    }));

    const toolCalls = mergeToolCalls({
        messages: messages.map((candidate) => ({
            content: candidate.message.content,
            id: candidate.message.id,
            metadata: candidate.message.metadata,
            sender: candidate.message.sender,
            senderType: candidate.message.senderType,
            sessionKey: candidate.message.sourceSessionKey,
            timestamp: candidate.message.timestamp,
        })),
        toolCalls: input.toolCalls,
    });

    for (const toolCall of toolCalls) {
        const actorCandidate = findToolActorCandidate(messages, toolCall);
        const actorMessage = actorCandidate?.message ?? null;
        const actor = actorMessage
            ? getMessageActor({
                  fallbackAgentId: actorCandidate?.agentId ?? null,
                  message: actorMessage,
              })
            : null;
        const messageToolSummary = actorMessage ? buildToolSummary(actorMessage) : null;

        rows.push({
            actor,
            completedAt: toolCall.finishedAt,
            connectsToNext: false,
            connectsToPrevious: false,
            id: `tool:${toolCall.id}`,
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: toolCall.sessionKey,
            spawnedRelationships: [],
            startedAt: toolCall.startedAt,
            toolCall: buildToolSummaryFromValues({
                argumentsValue: toolCall.arguments,
                callId: toolCall.toolCallId,
                isError: toolCall.isError,
                model: messageToolSummary?.model,
                name: toolCall.toolName,
                resultValue: toolCall.result,
            }),
        });
    }

    for (const current of messages) {
        const message = current.message;

        for (const thinking of buildSessionThinking([message])) {
            rows.push({
                id: thinking.id,
                kind: 'system',
                systemKind: 'thinking',
                thinking,
                timestamp: thinking.timestamp,
            });
        }

        if (buildToolSummary(message)) {
            continue;
        }

        if (message.senderType === 'system') {
            continue;
        }

        rows.push({
            actor: getMessageActor({
                fallbackAgentId: current.agentId,
                message,
            }),
            connectsToNext: false,
            connectsToPrevious: false,
            id: message.id,
            isFirstInGroup: true,
            kind: 'message',
            message,
        });
    }

    for (const candidate of input.workers) {
        const worker = candidate.worker;

        rows.push({
            actor: toAgentActor(worker.agentId),
            completedAt: worker.endedAt,
            connectsToNext: false,
            connectsToPrevious: false,
            id: `worker:${worker.id}`,
            isFirstInGroup: true,
            kind: 'worker',
            sessionKey: worker.sessionKey,
            startedAt: worker.startedAt ?? worker.createdAt,
            worker,
        });
    }

    rows.sort((left, right) => getRowTimestamp(left) - getRowTimestamp(right));

    return annotateRows(orderRowsForChatTurns(rows));
}

function orderRowsForChatTurns(rows: ChatLogPage['rows']) {
    const ordered = [...rows];
    let index = 0;

    while (index < ordered.length) {
        const row = ordered[index];
        const sessionKey = row ? getRowSessionKey(row) : null;

        if (
            !(
                row &&
                sessionKey &&
                isUserMessageRow(row) &&
                hasFollowingAgentMessage(ordered, index, sessionKey)
            )
        ) {
            index += 1;
            continue;
        }

        let activityStart = index;

        while (
            activityStart > 0 &&
            isAgentActivityRowForSession(ordered[activityStart - 1], sessionKey)
        ) {
            activityStart -= 1;
        }

        if (activityStart === index) {
            index += 1;
            continue;
        }

        const activityRows = ordered.splice(activityStart, index - activityStart);
        const userIndex = activityStart;

        ordered.splice(userIndex + 1, 0, ...activityRows);
        index = userIndex + activityRows.length + 2;
    }

    return ordered;
}

function isUserMessageRow(row: ChatLogPage['rows'][number]) {
    return row.kind === 'message' && row.message.senderType === 'user';
}

function hasFollowingAgentMessage(
    rows: ChatLogPage['rows'],
    startIndex: number,
    sessionKey: string
) {
    for (let index = startIndex + 1; index < rows.length; index += 1) {
        const row = rows[index];

        if (!row || getRowSessionKey(row) !== sessionKey) {
            continue;
        }

        if (row.kind !== 'message') {
            continue;
        }

        return row.message.senderType === 'agent';
    }

    return false;
}

function isAgentActivityRowForSession(
    row: ChatLogPage['rows'][number] | undefined,
    sessionKey: string
) {
    if (!(row && (row.kind === 'tool' || row.kind === 'worker'))) {
        return false;
    }

    return getRowSessionKey(row) === sessionKey;
}

function findToolActorCandidate(
    messages: { agentId: string | null; message: ChatRowMessage }[],
    toolCall: ChatToolCallCandidate
) {
    const candidates = messages.filter((candidate) => {
        if (candidate.message.sourceSessionKey !== toolCall.sessionKey) {
            return false;
        }

        if (toolCall.messageId && candidate.message.id === toolCall.messageId) {
            return true;
        }

        return Boolean(
            toolCall.toolCallId && getToolCallId(candidate.message) === toolCall.toolCallId
        );
    });

    return (
        candidates.find((candidate) => candidate.message.senderType === 'agent') ??
        candidates[0] ??
        null
    );
}
