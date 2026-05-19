import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import {
    cortexEncodingDimensions,
    cortexEncodingModel,
    cortexEncodingProvider,
    encodeCortexText,
} from './encoding';
import { createCortexId, hashText } from './ids';
import { extractWikiLinks, splitCortexChunks } from './markdown';
import { findPageRow } from './read';
import type { PageRow } from './rows';

export function refreshDerivedPageState(db: Database, page: PageRow, now: string): void {
    replaceLinks(db, page, now);
    replaceChunks(db, page, now);
}

function replaceLinks(db: Database, page: PageRow, now: string): void {
    db.prepare('DELETE FROM cortex_links WHERE from_page_id = ?').run(page.id);
    const links = new Map(
        extractWikiLinks(`${page.compiled_truth}\n${page.body}`).map((link) => [
            `${link.targetSlug}:${link.heading ?? ''}:${link.linkKind}`,
            link,
        ])
    );
    for (const link of links.values()) {
        const target = findPageRow(db, link.targetSlug);
        db.prepare(
            `INSERT INTO cortex_links
             (id, from_page_id, target_slug, target_page_id, heading, label, link_kind, source_location, created_at)
             VALUES ($id, $fromPageId, $targetSlug, $targetPageId, $heading, $label, $linkKind, $sourceLocation, $createdAt)`
        ).run(
            namedParams({
                createdAt: now,
                fromPageId: page.id,
                heading: link.heading,
                id: createCortexId('ctxl'),
                label: link.label,
                linkKind: link.linkKind,
                sourceLocation: link.sourceLocation,
                targetPageId: target?.id ?? null,
                targetSlug: link.targetSlug,
            })
        );
    }
}

function replaceChunks(db: Database, page: PageRow, now: string): void {
    db.prepare('DELETE FROM cortex_chunks WHERE page_id = ?').run(page.id);
    for (const chunk of splitCortexChunks({
        body: page.body,
        compiledTruth: page.compiled_truth,
    })) {
        const chunkId = createCortexId('ctxc');
        const textHash = hashText(chunk.text);
        db.prepare(
            `INSERT INTO cortex_chunks
             (id, page_id, section, ordinal, text, token_count, text_hash, created_at, updated_at)
             VALUES ($id, $pageId, $section, $ordinal, $text, $tokenCount, $textHash, $createdAt, $updatedAt)`
        ).run(
            namedParams({
                createdAt: now,
                id: chunkId,
                ordinal: chunk.ordinal,
                pageId: page.id,
                section: chunk.section,
                text: chunk.text,
                textHash,
                tokenCount: chunk.tokenCount,
                updatedAt: now,
            })
        );
        insertEncoding(db, { chunkId, text: chunk.text, textHash, now });
    }
}

function insertEncoding(
    db: Database,
    input: { chunkId: string; now: string; text: string; textHash: string }
): void {
    db.prepare(
        `INSERT INTO cortex_encodings
         (id, chunk_id, provider, model, dimensions, vector_json, input_text_hash, embedded_at)
         VALUES ($id, $chunkId, $provider, $model, $dimensions, $vectorJson, $textHash, $embeddedAt)`
    ).run(
        namedParams({
            chunkId: input.chunkId,
            dimensions: cortexEncodingDimensions,
            embeddedAt: input.now,
            id: createCortexId('ctxe'),
            model: cortexEncodingModel,
            provider: cortexEncodingProvider,
            textHash: input.textHash,
            vectorJson: JSON.stringify(encodeCortexText(input.text)),
        })
    );
}
