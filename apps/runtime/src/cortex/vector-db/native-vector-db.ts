import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { RUNTIME_ROOT, readConfigValue } from '../../config';
import type {
    CortexVectorDatabase,
    VectorDatabaseStatus,
    VectorRecord,
    VectorSearchHit,
    VectorSearchInput,
} from './types';

const vectorTableName = 'cortex_chunks';

interface VectorTable {
    add(data: unknown[]): Promise<unknown>;
    countRows(filter?: string): Promise<number>;
    delete(predicate: string): Promise<unknown>;
    vectorSearch(vector: number[]): {
        distanceType(distanceType: string): {
            where(predicate: string): {
                limit(limit: number): {
                    select(columns: string[]): {
                        toArray(): Promise<Record<string, unknown>[]>;
                    };
                };
            };
        };
    };
}

interface VectorConnection {
    createTable(
        name: string,
        data: Record<string, unknown>[],
        options?: { existOk?: boolean; mode?: 'create' | 'overwrite' }
    ): Promise<VectorTable>;
    openTable(name: string): Promise<VectorTable>;
    tableNames(): Promise<string[]>;
}

export function resolveCortexVectorPath() {
    return (
        readConfigValue('TAVERN_CORTEX_VECTOR_PATH') ??
        path.join(RUNTIME_ROOT, 'cortex', 'vector-index')
    );
}

export function createCortexVectorDatabase(): CortexVectorDatabase {
    return new NativeVectorDatabase(resolveCortexVectorPath());
}

class NativeVectorDatabase implements CortexVectorDatabase {
    readonly #path: string;

    constructor(vectorPath: string) {
        this.#path = vectorPath;
    }

    async ensure(): Promise<void> {
        await this.#connect();
    }

    async search(input: VectorSearchInput): Promise<VectorSearchHit[]> {
        const table = await this.#openExistingTable();
        if (!table) {
            return [];
        }
        const rows = await table
            .vectorSearch(input.vector)
            .distanceType('cosine')
            .where(
                [
                    `provider = ${sqlString(input.provider)}`,
                    `model = ${sqlString(input.model)}`,
                    `dimensions = ${input.dimensions}`,
                ].join(' AND ')
            )
            .limit(input.limit)
            .select(['chunk_id', 'page_id', 'text_hash', '_distance'])
            .toArray();

        return rows.flatMap((row) => {
            const chunkId = readString(row.chunk_id);
            const pageId = readString(row.page_id);
            const textHash = readString(row.text_hash);
            const distance = readNumber(row._distance);
            if (!(chunkId && pageId && textHash && distance !== null)) {
                return [];
            }
            return [
                {
                    chunkId,
                    distance,
                    pageId,
                    score: Math.max(0, 1 - distance),
                    textHash,
                },
            ];
        });
    }

    async status(): Promise<VectorDatabaseStatus> {
        try {
            const table = await this.#openExistingTable();
            return {
                backend: 'lancedb',
                degradedReason: null,
                indexedCount: table ? await table.countRows() : 0,
                path: this.#path,
                table: vectorTableName,
            };
        } catch (error) {
            return {
                backend: 'lancedb',
                degradedReason: error instanceof Error ? error.message : String(error),
                indexedCount: 0,
                path: this.#path,
                table: vectorTableName,
            };
        }
    }

    async upsert(records: VectorRecord[]): Promise<void> {
        if (records.length === 0) {
            return;
        }

        const table = await this.#openTableForWrite(records);
        for (const record of records) {
            await table.delete(`chunk_id = ${sqlString(record.chunkId)}`);
        }
        await table.add(records.map(toRow));
    }

    async #connect(): Promise<VectorConnection> {
        await mkdir(this.#path, { recursive: true });
        const module = await import('@lancedb/lancedb');
        return (await module.connect(this.#path)) as VectorConnection;
    }

    async #openExistingTable(): Promise<VectorTable | null> {
        const connection = await this.#connect();
        if ((await connection.tableNames()).includes(vectorTableName)) {
            return await connection.openTable(vectorTableName);
        }

        return null;
    }

    async #openTableForWrite(seedRecords: VectorRecord[]): Promise<VectorTable> {
        const connection = await this.#connect();
        if ((await connection.tableNames()).includes(vectorTableName)) {
            return await connection.openTable(vectorTableName);
        }

        return await connection.createTable(vectorTableName, seedRecords.map(toRow), {
            existOk: true,
            mode: 'create',
        });
    }
}

function toRow(record: VectorRecord) {
    return {
        chunk_id: record.chunkId,
        dimensions: record.dimensions,
        model: record.model,
        page_id: record.pageId,
        provider: record.provider,
        section: record.section,
        source_id: record.sourceId ?? '',
        text_hash: record.textHash,
        vector: record.vector,
    };
}

function sqlString(value: string) {
    return `'${value.replaceAll("'", "''")}'`;
}

function readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
