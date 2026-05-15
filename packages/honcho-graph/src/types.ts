export type MemoryLevel = 'contradiction' | 'deductive' | 'explicit' | 'inductive';

export type GraphNodeKind = 'pair' | 'peer' | 'session';
export type GraphEdgeKind = 'about' | 'appears_in' | 'observes' | 'participates_in';

export interface LevelCounts {
    contradiction: number;
    deductive: number;
    explicit: number;
    inductive: number;
}

export interface MemoryPreview {
    content: string;
    createdAt: string;
    id: string;
    level: MemoryLevel;
    sessionName: string | null;
}

export interface PairSummary {
    id: string;
    label: string;
    memoryCount: number;
    observedPeerName: string;
    observerPeerName: string;
}

export interface SessionSummary {
    memoryCount: number;
    sessionName: string;
}

export interface GraphStats {
    contradictionCount: number;
    deductiveCount: number;
    explicitCount: number;
    inductiveCount: number;
    totalEdges: number;
    totalMemories: number;
    totalPairs: number;
    totalPeers: number;
    totalSessions: number;
}

export interface PeerNodeMetrics {
    activeSessionCount: number;
    conclusionCount: number;
    createdAt: string;
    lastConclusionAt: string | null;
    lastMessageAt: string | null;
    messageCount: number;
    observedByCount: number;
    observesCount: number;
    peerName: string;
    representationInCount: number;
    representationOutCount: number;
    sessionCount: number;
    strongestIncomingPairs: PairSummary[];
    strongestOutgoingPairs: PairSummary[];
}

export interface SessionNodeMetrics {
    activeParticipantCount: number;
    createdAt: string;
    isActive: boolean;
    lastMemoryAt: string | null;
    lastMessageAt: string | null;
    levelCounts: LevelCounts;
    memoryCount: number;
    messageCount: number;
    pairCount: number;
    participantCount: number;
    recentMemories: MemoryPreview[];
    sessionName: string;
    topPairs: PairSummary[];
}

export interface PairNodeMetrics {
    lastMemoryAt: string | null;
    levelCounts: LevelCounts;
    memoryCount: number;
    observedPeerName: string;
    observerPeerName: string;
    recentMemories: MemoryPreview[];
    sessionCount: number;
    topSessions: SessionSummary[];
}

export interface ParticipationEdgeMetrics {
    isActive: boolean;
    joinedAt: string;
    lastMessageAt: string | null;
    leftAt: string | null;
    messageCount: number;
    observeMe: boolean;
    observeOthers: boolean;
    rawConfiguration: Record<string, unknown>;
}

export interface AboutEdgeMetrics {
    lastMemoryAt: string | null;
    memoryCount: number;
    observedPeerName: string;
    observerPeerName: string;
    relationship: 'about';
}

export interface AppearsInEdgeMetrics {
    levelCounts: LevelCounts;
    memoryCount: number;
    relationship: 'appears_in';
    sessionName: string;
}

export interface ObservesEdgeMetrics {
    lastMemoryAt: string | null;
    memoryCount: number;
    observedPeerName: string;
    observerPeerName: string;
    relationship: 'observes';
}

export interface PairNodeRecord {
    id: string;
    kind: 'pair';
    label: string;
    metrics: PairNodeMetrics;
    workspaceName: string;
}

export interface PeerNodeRecord {
    id: string;
    kind: 'peer';
    label: string;
    metrics: PeerNodeMetrics;
    workspaceName: string;
}

export interface SessionNodeRecord {
    id: string;
    kind: 'session';
    label: string;
    metrics: SessionNodeMetrics;
    workspaceName: string;
}

export type GraphNodeRecord = PairNodeRecord | PeerNodeRecord | SessionNodeRecord;

export interface AboutEdgeRecord {
    id: string;
    kind: 'about';
    metrics: AboutEdgeMetrics;
    sourceId: string;
    targetId: string;
    workspaceName: string;
}

export interface AppearsInEdgeRecord {
    id: string;
    kind: 'appears_in';
    metrics: AppearsInEdgeMetrics;
    sourceId: string;
    targetId: string;
    workspaceName: string;
}

export interface ObservesEdgeRecord {
    id: string;
    kind: 'observes';
    metrics: ObservesEdgeMetrics;
    sourceId: string;
    targetId: string;
    workspaceName: string;
}

export interface ParticipationEdgeRecord {
    id: string;
    kind: 'participates_in';
    metrics: ParticipationEdgeMetrics;
    sourceId: string;
    targetId: string;
    workspaceName: string;
}

export type GraphEdgeRecord =
    | AboutEdgeRecord
    | AppearsInEdgeRecord
    | ObservesEdgeRecord
    | ParticipationEdgeRecord;

export interface GraphSnapshot {
    edges: GraphEdgeRecord[];
    generatedAt: string;
    nodes: GraphNodeRecord[];
    stats: GraphStats;
    workspaceName: string;
}

export interface WorkspaceRecord {
    createdAt: string;
    name: string;
}

export interface PeerAggregateRow {
    activeSessionCount: number;
    conclusionCount: number;
    createdAt: Date | string;
    lastConclusionAt: Date | string | null;
    lastMessageAt: Date | string | null;
    messageCount: number;
    name: string;
    representationInCount: number;
    representationOutCount: number;
    sessionCount: number;
    workspaceName: string;
}

export interface SessionAggregateRow {
    activeParticipantCount: number;
    createdAt: Date | string;
    isActive: boolean;
    lastMessageAt: Date | string | null;
    messageCount: number;
    name: string;
    participantCount: number;
    workspaceName: string;
}

export interface SessionPeerAggregateRow {
    configuration: Record<string, unknown> | null;
    joinedAt: Date | string;
    lastMessageAt: Date | string | null;
    leftAt: Date | string | null;
    messageCount: number;
    peerName: string;
    sessionName: string;
    workspaceName: string;
}

export interface RepresentationAggregateRow {
    collectionCreatedAt: Date | string;
    conclusionCount: number;
    contradictionCount: number;
    deductiveCount: number;
    explicitCount: number;
    inductiveCount: number;
    lastConclusionAt: Date | string | null;
    observed: string;
    observer: string;
    sessionCount: number;
    workspaceName: string;
}

export interface MemoryAggregateRow {
    content: string;
    createdAt: Date | string;
    id: string;
    level: MemoryLevel;
    observed: string;
    observer: string;
    sessionName: string | null;
    sourceIds: string[] | null;
    timesDerived: number;
    workspaceName: string;
}

export interface WorkspaceSourceSnapshot {
    memoryRows: MemoryAggregateRow[];
    peerRows: PeerAggregateRow[];
    representationRows: RepresentationAggregateRow[];
    sessionPeerRows: SessionPeerAggregateRow[];
    sessionRows: SessionAggregateRow[];
    workspaceName: string;
}
