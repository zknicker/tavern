import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
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
    const currentKeys = new Set<string>();
    for (const chunk of splitCortexChunks({
        body: page.body,
        compiledTruth: page.compiled_truth,
    })) {
        currentKeys.add(`${chunk.section}:${chunk.ordinal}`);
        const textHash = hashText(chunk.text);
        const existing = db
            .prepare(
                `SELECT id
                 FROM cortex_chunks
                 WHERE page_id = $pageId
                   AND source_id IS NULL
                   AND section = $section
                   AND ordinal = $ordinal
                 LIMIT 1`
            )
            .get(
                namedParams({
                    ordinal: chunk.ordinal,
                    pageId: page.id,
                    section: chunk.section,
                })
            ) as { id: string } | null;

        if (existing) {
            db.prepare(
                `UPDATE cortex_chunks
                 SET text = $text,
                     token_count = $tokenCount,
                     text_hash = $textHash,
                     updated_at = $updatedAt
                 WHERE id = $id`
            ).run(
                namedParams({
                    id: existing.id,
                    text: chunk.text,
                    textHash,
                    tokenCount: chunk.tokenCount,
                    updatedAt: now,
                })
            );
            continue;
        }

        db.prepare(
            `INSERT INTO cortex_chunks
             (id, page_id, section, ordinal, text, token_count, text_hash, created_at, updated_at)
             VALUES ($id, $pageId, $section, $ordinal, $text, $tokenCount, $textHash, $createdAt, $updatedAt)`
        ).run(
            namedParams({
                createdAt: now,
                id: createCortexId('ctxc'),
                ordinal: chunk.ordinal,
                pageId: page.id,
                section: chunk.section,
                text: chunk.text,
                textHash,
                tokenCount: chunk.tokenCount,
                updatedAt: now,
            })
        );
    }

    for (const existing of db
        .prepare(
            `SELECT id, section, ordinal
             FROM cortex_chunks
             WHERE page_id = ?
               AND source_id IS NULL`
        )
        .all(page.id) as Array<{ id: string; ordinal: number; section: string }>) {
        if (!currentKeys.has(`${existing.section}:${existing.ordinal}`)) {
            db.prepare('DELETE FROM cortex_chunks WHERE id = ?').run(existing.id);
        }
    }
}
