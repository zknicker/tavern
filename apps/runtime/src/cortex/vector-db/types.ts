export interface VectorRecord {
    chunkId: string;
    dimensions: number;
    model: string;
    pageId: string;
    provider: string;
    section: string;
    sourceId: string | null;
    textHash: string;
    vector: number[];
}

export interface VectorSearchHit {
    chunkId: string;
    distance: number;
    pageId: string;
    score: number;
    textHash: string;
}

export interface VectorSearchInput {
    dimensions: number;
    limit: number;
    model: string;
    provider: string;
    vector: number[];
}

export interface VectorDatabaseStatus {
    backend: string;
    degradedReason: string | null;
    indexedCount: number;
    path: string;
    table: string;
}

export interface CortexVectorDatabase {
    ensure(): Promise<void>;
    search(input: VectorSearchInput): Promise<VectorSearchHit[]>;
    status(): Promise<VectorDatabaseStatus>;
    upsert(records: VectorRecord[]): Promise<void>;
}
