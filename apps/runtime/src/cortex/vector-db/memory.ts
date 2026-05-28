import type {
    CortexVectorDatabase,
    VectorDatabaseStatus,
    VectorRecord,
    VectorSearchHit,
    VectorSearchInput,
} from './types';

export class MemoryVectorDatabase implements CortexVectorDatabase {
    readonly #records = new Map<string, VectorRecord>();

    async ensure(): Promise<void> {}

    async search(input: VectorSearchInput): Promise<VectorSearchHit[]> {
        return [...this.#records.values()]
            .filter(
                (record) =>
                    record.provider === input.provider &&
                    record.model === input.model &&
                    record.dimensions === input.dimensions
            )
            .map((record) => {
                const score = dotProduct(record.vector, input.vector);
                return {
                    chunkId: record.chunkId,
                    distance: 1 - score,
                    pageId: record.pageId,
                    score,
                    textHash: record.textHash,
                };
            })
            .filter((hit) => hit.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, input.limit);
    }

    async status(): Promise<VectorDatabaseStatus> {
        return {
            backend: 'memory',
            degradedReason: null,
            indexedCount: this.#records.size,
            path: 'memory',
            table: 'memory',
        };
    }

    async upsert(records: VectorRecord[]): Promise<void> {
        for (const record of records) {
            this.#records.set(record.chunkId, record);
        }
    }
}

function dotProduct(left: number[], right: number[]) {
    const length = Math.min(left.length, right.length);
    let score = 0;
    for (let index = 0; index < length; index += 1) {
        score += (left[index] ?? 0) * (right[index] ?? 0);
    }
    return Math.max(0, score);
}
