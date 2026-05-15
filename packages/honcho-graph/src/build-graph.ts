import {
    createAboutEdgeId,
    createAppearsInEdgeId,
    createObservesEdgeId,
    createPairNodeId,
    createParticipationEdgeId,
    createPeerNodeId,
    createSessionNodeId,
} from './ids.ts';
import { toIsoString, toNullableIsoString } from './time.ts';
import type {
    GraphEdgeRecord,
    GraphNodeRecord,
    GraphStats,
    LevelCounts,
    MemoryAggregateRow,
    MemoryPreview,
    PairSummary,
    WorkspaceSourceSnapshot,
} from './types.ts';

const PREVIEW_LIMIT = 8;
const SUMMARY_LIMIT = 5;

interface PairAggregate {
    id: string;
    label: string;
    lastMemoryAt: string | null;
    levelCounts: LevelCounts;
    memories: MemoryPreview[];
    memoryCount: number;
    observedPeerName: string;
    observerPeerName: string;
    sessions: Map<string, number>;
}

function createEmptyLevelCounts(): LevelCounts {
    return {
        contradiction: 0,
        deductive: 0,
        explicit: 0,
        inductive: 0,
    };
}

function incrementLevelCount(levelCounts: LevelCounts, level: MemoryAggregateRow['level']) {
    levelCounts[level] += 1;
}

function summarizePairs(pairs: PairAggregate[]) {
    return pairs
        .sort((left, right) => right.memoryCount - left.memoryCount)
        .slice(0, SUMMARY_LIMIT)
        .map<PairSummary>((pair) => ({
            id: pair.id,
            label: pair.label,
            memoryCount: pair.memoryCount,
            observedPeerName: pair.observedPeerName,
            observerPeerName: pair.observerPeerName,
        }));
}

function toSessionSummaries(sessions: Map<string, number>) {
    return [...sessions.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, SUMMARY_LIMIT)
        .map(([sessionName, memoryCount]) => ({ memoryCount, sessionName }));
}

function toRecentMemories(memories: MemoryPreview[]) {
    return memories
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, PREVIEW_LIMIT);
}

function collectLevelCounts(memories: MemoryPreview[]) {
    const counts = createEmptyLevelCounts();

    for (const memory of memories) {
        incrementLevelCount(counts, memory.level);
    }

    return counts;
}

function readBooleanFlag(
    configuration: Record<string, unknown> | null,
    key: 'observe_me' | 'observe_others'
) {
    return configuration?.[key] === true;
}

function aggregatePairs(source: WorkspaceSourceSnapshot) {
    const pairs = new Map<string, PairAggregate>();

    for (const row of source.memoryRows) {
        const pairId = createPairNodeId(row.workspaceName, row.observer, row.observed);
        const createdAt = toIsoString(row.createdAt);
        const current = pairs.get(pairId) ?? {
            id: pairId,
            label: `${row.observer} -> ${row.observed}`,
            lastMemoryAt: null,
            levelCounts: createEmptyLevelCounts(),
            memoryCount: 0,
            memories: [],
            observedPeerName: row.observed,
            observerPeerName: row.observer,
            sessions: new Map<string, number>(),
        };

        current.memoryCount += 1;
        current.lastMemoryAt =
            current.lastMemoryAt === null || createdAt > current.lastMemoryAt
                ? createdAt
                : current.lastMemoryAt;
        current.memories.push({
            content: row.content,
            createdAt,
            id: row.id,
            level: row.level,
            sessionName: row.sessionName,
        });
        incrementLevelCount(current.levelCounts, row.level);

        if (row.sessionName) {
            current.sessions.set(row.sessionName, (current.sessions.get(row.sessionName) ?? 0) + 1);
        }

        pairs.set(pairId, current);
    }

    return [...pairs.values()].sort((left, right) => right.memoryCount - left.memoryCount);
}

export function buildGraphSnapshot(source: WorkspaceSourceSnapshot) {
    const pairAggregates = aggregatePairs(source);
    const peerOutgoing = new Map<string, PairAggregate[]>();
    const peerIncoming = new Map<string, PairAggregate[]>();
    const sessionPairs = new Map<string, PairAggregate[]>();
    const sessionMemories = new Map<string, MemoryPreview[]>();
    const sessionCounts = new Map<string, LevelCounts>();
    const sessionLastMemoryAt = new Map<string, string>();

    for (const pair of pairAggregates) {
        const outgoing = peerOutgoing.get(pair.observerPeerName) ?? [];
        outgoing.push(pair);
        peerOutgoing.set(pair.observerPeerName, outgoing);

        const incoming = peerIncoming.get(pair.observedPeerName) ?? [];
        incoming.push(pair);
        peerIncoming.set(pair.observedPeerName, incoming);

        for (const memory of pair.memories) {
            if (!memory.sessionName) {
                continue;
            }

            const pairs = sessionPairs.get(memory.sessionName) ?? [];
            if (!pairs.includes(pair)) {
                pairs.push(pair);
                sessionPairs.set(memory.sessionName, pairs);
            }

            const memories = sessionMemories.get(memory.sessionName) ?? [];
            memories.push(memory);
            sessionMemories.set(memory.sessionName, memories);

            const counts = sessionCounts.get(memory.sessionName) ?? createEmptyLevelCounts();
            incrementLevelCount(counts, memory.level);
            sessionCounts.set(memory.sessionName, counts);

            const lastMemoryAt = sessionLastMemoryAt.get(memory.sessionName);
            if (!lastMemoryAt || memory.createdAt > lastMemoryAt) {
                sessionLastMemoryAt.set(memory.sessionName, memory.createdAt);
            }
        }
    }

    const nodes: GraphNodeRecord[] = [
        ...source.peerRows.map((row) => ({
            id: createPeerNodeId(row.workspaceName, row.name),
            kind: 'peer' as const,
            label: row.name,
            metrics: {
                activeSessionCount: row.activeSessionCount,
                conclusionCount: row.conclusionCount,
                createdAt: toIsoString(row.createdAt),
                lastConclusionAt: toNullableIsoString(row.lastConclusionAt),
                lastMessageAt: toNullableIsoString(row.lastMessageAt),
                messageCount: row.messageCount,
                observedByCount: (peerIncoming.get(row.name) ?? []).length,
                observesCount: (peerOutgoing.get(row.name) ?? []).length,
                peerName: row.name,
                representationInCount: row.representationInCount,
                representationOutCount: row.representationOutCount,
                sessionCount: row.sessionCount,
                strongestIncomingPairs: summarizePairs(peerIncoming.get(row.name) ?? []),
                strongestOutgoingPairs: summarizePairs(peerOutgoing.get(row.name) ?? []),
            },
            workspaceName: row.workspaceName,
        })),
        ...source.sessionRows.map((row) => ({
            id: createSessionNodeId(row.workspaceName, row.name),
            kind: 'session' as const,
            label: row.name,
            metrics: {
                activeParticipantCount: row.activeParticipantCount,
                createdAt: toIsoString(row.createdAt),
                isActive: row.isActive,
                lastMemoryAt: sessionLastMemoryAt.get(row.name) ?? null,
                lastMessageAt: toNullableIsoString(row.lastMessageAt),
                levelCounts: sessionCounts.get(row.name) ?? createEmptyLevelCounts(),
                memoryCount: (sessionMemories.get(row.name) ?? []).length,
                messageCount: row.messageCount,
                participantCount: row.participantCount,
                pairCount: (sessionPairs.get(row.name) ?? []).length,
                recentMemories: toRecentMemories(sessionMemories.get(row.name) ?? []),
                sessionName: row.name,
                topPairs: summarizePairs(sessionPairs.get(row.name) ?? []),
            },
            workspaceName: row.workspaceName,
        })),
        ...pairAggregates.map((pair) => ({
            id: pair.id,
            kind: 'pair' as const,
            label: pair.label,
            metrics: {
                lastMemoryAt: pair.lastMemoryAt,
                levelCounts: pair.levelCounts,
                memoryCount: pair.memoryCount,
                observedPeerName: pair.observedPeerName,
                observerPeerName: pair.observerPeerName,
                recentMemories: toRecentMemories(pair.memories),
                sessionCount: pair.sessions.size,
                topSessions: toSessionSummaries(pair.sessions),
            },
            workspaceName: source.workspaceName,
        })),
    ];

    const edges: GraphEdgeRecord[] = [
        ...pairAggregates.flatMap((pair) => [
            {
                id: createObservesEdgeId(
                    source.workspaceName,
                    pair.observerPeerName,
                    pair.observedPeerName
                ),
                kind: 'observes' as const,
                metrics: {
                    lastMemoryAt: pair.lastMemoryAt,
                    memoryCount: pair.memoryCount,
                    observedPeerName: pair.observedPeerName,
                    observerPeerName: pair.observerPeerName,
                    relationship: 'observes' as const,
                },
                sourceId: createPeerNodeId(source.workspaceName, pair.observerPeerName),
                targetId: pair.id,
                workspaceName: source.workspaceName,
            },
            {
                id: createAboutEdgeId(
                    source.workspaceName,
                    pair.observerPeerName,
                    pair.observedPeerName
                ),
                kind: 'about' as const,
                metrics: {
                    lastMemoryAt: pair.lastMemoryAt,
                    memoryCount: pair.memoryCount,
                    observedPeerName: pair.observedPeerName,
                    observerPeerName: pair.observerPeerName,
                    relationship: 'about' as const,
                },
                sourceId: pair.id,
                targetId: createPeerNodeId(source.workspaceName, pair.observedPeerName),
                workspaceName: source.workspaceName,
            },
            ...[...pair.sessions.entries()].map(([sessionName, memoryCount]) => ({
                id: createAppearsInEdgeId(
                    source.workspaceName,
                    pair.observerPeerName,
                    pair.observedPeerName,
                    sessionName
                ),
                kind: 'appears_in' as const,
                metrics: {
                    levelCounts: collectLevelCounts(
                        pair.memories.filter((memory) => memory.sessionName === sessionName)
                    ),
                    memoryCount,
                    relationship: 'appears_in' as const,
                    sessionName,
                },
                sourceId: pair.id,
                targetId: createSessionNodeId(source.workspaceName, sessionName),
                workspaceName: source.workspaceName,
            })),
        ]),
        ...source.sessionPeerRows.map((row) => ({
            id: createParticipationEdgeId(row.workspaceName, row.sessionName, row.peerName),
            kind: 'participates_in' as const,
            metrics: {
                isActive: row.leftAt === null,
                joinedAt: toIsoString(row.joinedAt),
                lastMessageAt: toNullableIsoString(row.lastMessageAt),
                leftAt: toNullableIsoString(row.leftAt),
                messageCount: row.messageCount,
                observeMe: readBooleanFlag(row.configuration, 'observe_me'),
                observeOthers: readBooleanFlag(row.configuration, 'observe_others'),
                rawConfiguration: row.configuration ?? {},
            },
            sourceId: createPeerNodeId(row.workspaceName, row.peerName),
            targetId: createSessionNodeId(row.workspaceName, row.sessionName),
            workspaceName: row.workspaceName,
        })),
    ];

    const stats: GraphStats = {
        contradictionCount: source.memoryRows.filter((row) => row.level === 'contradiction').length,
        deductiveCount: source.memoryRows.filter((row) => row.level === 'deductive').length,
        explicitCount: source.memoryRows.filter((row) => row.level === 'explicit').length,
        inductiveCount: source.memoryRows.filter((row) => row.level === 'inductive').length,
        totalEdges: edges.length,
        totalMemories: source.memoryRows.length,
        totalPairs: pairAggregates.length,
        totalPeers: source.peerRows.length,
        totalSessions: source.sessionRows.length,
    };

    return { edges, nodes, stats };
}
