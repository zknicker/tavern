import type { CortexDatabase } from './db';
import { embedCortexText } from './encoding';
import { createCortexId } from './ids';
import { getCortexSettings } from './settings';

interface ChunkRow {
    id: string;
    page_id: string;
    section: string;
    source_id: string | null;
    text: string;
    text_hash: string;
}

export interface EmbeddedChunkRecord {
    chunkId: string;
    dimensions: number;
    model: string;
    pageId: string;
    provider: string;
    section: string;
    sourceId: string | null;
    textHash: string;
}

export async function countCortexEmbeddingBacklog(db: CortexDatabase): Promise<number> {
    const embedding = (await getCortexSettings(db)).embedding;
    return (
        (await db
            .prepare(
                `SELECT COUNT(*) AS count
                 FROM cortex_chunks c
                 JOIN cortex_pages p ON p.id = c.page_id
                 LEFT JOIN cortex_encodings e
                   ON e.chunk_id = c.id
                  AND e.provider = $provider
                  AND e.model = $model
                  AND e.dimensions = $dimensions
                 WHERE p.deleted_at IS NULL
                   AND p.status IN ('active', 'stale')
                   AND (e.id IS NULL OR e.input_text_hash != c.text_hash)`
            )
            .get<{ count: number }>({
                dimensions: embedding.dimensions,
                model: embedding.model,
                provider: embedding.provider,
            })) ?? { count: 0 }
    ).count;
}

export async function generateStaleCortexEmbeddings(
    db: CortexDatabase,
    now: string
): Promise<EmbeddedChunkRecord[]> {
    const embedding = (await getCortexSettings(db)).embedding;
    const rows = await db
        .prepare(
            `SELECT c.id,
                    c.page_id,
                    c.source_id,
                    c.section,
                    c.text,
                    c.text_hash
             FROM cortex_chunks c
             JOIN cortex_pages p ON p.id = c.page_id
             LEFT JOIN cortex_encodings e
               ON e.chunk_id = c.id
              AND e.provider = $provider
              AND e.model = $model
              AND e.dimensions = $dimensions
             WHERE p.deleted_at IS NULL
               AND p.status IN ('active', 'stale')
               AND (e.id IS NULL OR e.input_text_hash != c.text_hash)`
        )
        .all<ChunkRow>({
            dimensions: embedding.dimensions,
            model: embedding.model,
            provider: embedding.provider,
        });

    const records: EmbeddedChunkRecord[] = [];
    for (const row of rows) {
        const result = await embedCortexText(db, row.text);
        if (!result) {
            continue;
        }
        await upsertEncoding(db, {
            chunkId: row.id,
            dimensions: result.dimensions,
            now,
            model: result.model,
            provider: result.provider,
            textHash: row.text_hash,
            vector: result.vector,
        });
        records.push({
            chunkId: row.id,
            dimensions: result.dimensions,
            model: result.model,
            pageId: row.page_id,
            provider: result.provider,
            section: row.section,
            sourceId: row.source_id,
            textHash: row.text_hash,
        });
    }

    return records;
}

async function upsertEncoding(
    db: CortexDatabase,
    input: {
        chunkId: string;
        dimensions: number;
        model: string;
        now: string;
        provider: string;
        textHash: string;
        vector: number[];
    }
): Promise<void> {
    await db
        .prepare(
            `INSERT INTO cortex_encodings
             (id, chunk_id, provider, model, dimensions, embedding, input_text_hash, embedded_at)
             VALUES ($id, $chunkId, $provider, $model, $dimensions, $embedding, $textHash, $embeddedAt)
             ON CONFLICT(chunk_id, provider, model, dimensions) DO UPDATE SET
               embedding = excluded.embedding,
               input_text_hash = excluded.input_text_hash,
               embedded_at = excluded.embedded_at`
        )
        .run({
            chunkId: input.chunkId,
            dimensions: input.dimensions,
            embeddedAt: input.now,
            embedding: `[${input.vector.join(',')}]`,
            id: createCortexId('ctxe'),
            model: input.model,
            provider: input.provider,
            textHash: input.textHash,
        });
}
