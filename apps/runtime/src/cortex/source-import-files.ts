import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CortexImportFile } from '@tavern/api';
import type { CortexDatabase } from './db';
import { hashText } from './ids';
import { resolveCortexWikiPath } from './read';
import { nowIso } from './rows';

export interface CortexRawImportFile {
    bytes: Uint8Array;
    mediaType: string | null;
    metadata: Record<string, unknown>;
    name: string;
}

export async function preserveImportFiles(
    db: CortexDatabase,
    input: {
        files: CortexRawImportFile[];
        pageId: string;
        slug: string;
        sourceId: string;
    }
): Promise<CortexImportFile[]> {
    const output: CortexImportFile[] = [];
    for (const file of input.files) {
        const relativePath = path.join('.raw', input.slug, safeFileName(file.name));
        const absolutePath = path.join(resolveCortexWikiPath(), relativePath);
        const now = nowIso();
        const hash = hashText(Buffer.from(file.bytes).toString('base64'));
        const id = `ctxf_${hashText(`${input.sourceId}:${relativePath}`).slice(0, 24)}`;
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, file.bytes);
        await upsertCortexFile(db, {
            file,
            hash,
            id,
            now,
            relativePath,
            sourceId: input.sourceId,
        });
        await insertRawSourceCitation(db, {
            fileId: id,
            now,
            pageId: input.pageId,
            relativePath,
            sourceId: input.sourceId,
        });
        output.push({
            hash,
            id,
            mediaType: file.mediaType,
            metadata: file.metadata,
            path: relativePath,
        });
    }
    return output;
}

export function rawImportFile(
    value: string | Uint8Array,
    name: string,
    mediaType?: string | null
): CortexRawImportFile {
    return {
        bytes: typeof value === 'string' ? new TextEncoder().encode(value) : value,
        mediaType: mediaType ?? null,
        metadata: {},
        name,
    };
}

async function upsertCortexFile(
    db: CortexDatabase,
    input: {
        file: CortexRawImportFile;
        hash: string;
        id: string;
        now: string;
        relativePath: string;
        sourceId: string;
    }
): Promise<void> {
    await db
        .prepare(
            `INSERT INTO cortex_files
             (id, source_id, path, media_type, hash, metadata_json, created_at, updated_at)
             VALUES ($id, $sourceId, $path, $mediaType, $hash, $metadata, $createdAt, $updatedAt)
             ON CONFLICT(id) DO UPDATE SET
               media_type = excluded.media_type,
               hash = excluded.hash,
               metadata_json = excluded.metadata_json,
               updated_at = excluded.updated_at`
        )
        .run({
            createdAt: input.now,
            hash: input.hash,
            id: input.id,
            mediaType: input.file.mediaType,
            metadata: JSON.stringify(input.file.metadata),
            path: input.relativePath,
            sourceId: input.sourceId,
            updatedAt: input.now,
        });
}

async function insertRawSourceCitation(
    db: CortexDatabase,
    input: {
        fileId: string;
        now: string;
        pageId: string;
        relativePath: string;
        sourceId: string;
    }
): Promise<void> {
    await db
        .prepare(
            `INSERT INTO cortex_citations
             (id, page_id, source_id, file_id, locator, quote, metadata_json, created_at)
             VALUES ($id, $pageId, $sourceId, $fileId, $locator, NULL, $metadata, $createdAt)
             ON CONFLICT(id) DO NOTHING`
        )
        .run({
            createdAt: input.now,
            fileId: input.fileId,
            id: `ctxc_${hashText(`${input.pageId}:${input.fileId}`).slice(0, 24)}`,
            locator: input.relativePath,
            metadata: JSON.stringify({ kind: 'raw-source' }),
            pageId: input.pageId,
            sourceId: input.sourceId,
        });
}

function safeFileName(name: string): string {
    return (
        path
            .basename(name)
            .replace(/[^A-Za-z0-9._-]/gu, '-')
            .slice(0, 120) || 'source.txt'
    );
}
