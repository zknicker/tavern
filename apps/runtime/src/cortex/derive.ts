import { getActiveCortexSchema } from './cortex-schema';
import type { CortexDatabase } from './db';
import { createCortexId, hashText } from './ids';
import { extractCortexLinks, splitCortexChunks } from './markdown';
import { findPageRow } from './read';
import { type PageRow, readJsonRecord } from './rows';

export async function refreshDerivedPageState(
    db: CortexDatabase,
    page: PageRow,
    now: string
): Promise<void> {
    await refreshCortexPageLinks(db, page, now);
    await replaceChunks(db, page, now);
}

export async function refreshCortexPageLinks(
    db: CortexDatabase,
    page: PageRow,
    now: string,
    options: { dryRun?: boolean } = {}
): Promise<number> {
    const schema = await getActiveCortexSchema(db);
    const links = new Map(
        extractCortexLinks({
            body: page.body,
            compiledTruth: page.compiled_truth,
            frontmatter: readJsonRecord(page.frontmatter_json),
            pageType: page.type,
            schema,
        }).map((link) => [`${link.targetSlug}:${link.heading ?? ''}:${link.linkKind}`, link])
    );
    if (options.dryRun) {
        return links.size;
    }

    await db.prepare('DELETE FROM cortex_links WHERE from_page_id = ?').run(page.id);
    for (const link of links.values()) {
        const target = await findPageRow(db, link.targetSlug);
        await db
            .prepare(
                `INSERT INTO cortex_links
             (id, from_page_id, target_slug, target_page_id, heading, label, link_kind, source_location, created_at)
             VALUES ($id, $fromPageId, $targetSlug, $targetPageId, $heading, $label, $linkKind, $sourceLocation, $createdAt)`
            )
            .run({
                createdAt: now,
                fromPageId: page.id,
                heading: link.heading,
                id: createCortexId('ctxl'),
                label: link.label,
                linkKind: link.linkKind,
                sourceLocation: link.sourceLocation,
                targetPageId: target?.id ?? null,
                targetSlug: link.targetSlug,
            });
    }
    return links.size;
}

async function replaceChunks(db: CortexDatabase, page: PageRow, now: string): Promise<void> {
    const currentKeys = new Set<string>();
    for (const chunk of splitCortexChunks({
        body: page.body,
        compiledTruth: page.compiled_truth,
    })) {
        currentKeys.add(`${chunk.section}:${chunk.ordinal}`);
        const textHash = hashText(chunk.text);
        const existing = await db
            .prepare(
                `SELECT id
                 FROM cortex_chunks
                 WHERE page_id = $pageId
                   AND source_id IS NULL
                   AND section = $section
                   AND ordinal = $ordinal
                 LIMIT 1`
            )
            .get<{ id: string }>({
                ordinal: chunk.ordinal,
                pageId: page.id,
                section: chunk.section,
            });

        if (existing) {
            await db
                .prepare(
                    `UPDATE cortex_chunks
                 SET text = $text,
                     token_count = $tokenCount,
                     text_hash = $textHash,
                     updated_at = $updatedAt
                 WHERE id = $id`
                )
                .run({
                    id: existing.id,
                    text: chunk.text,
                    textHash,
                    tokenCount: chunk.tokenCount,
                    updatedAt: now,
                });
            continue;
        }

        await db
            .prepare(
                `INSERT INTO cortex_chunks
             (id, page_id, section, ordinal, text, token_count, text_hash, created_at, updated_at)
             VALUES ($id, $pageId, $section, $ordinal, $text, $tokenCount, $textHash, $createdAt, $updatedAt)`
            )
            .run({
                createdAt: now,
                id: createCortexId('ctxc'),
                ordinal: chunk.ordinal,
                pageId: page.id,
                section: chunk.section,
                text: chunk.text,
                textHash,
                tokenCount: chunk.tokenCount,
                updatedAt: now,
            });
    }

    for (const existing of await db
        .prepare(
            `SELECT id, section, ordinal
             FROM cortex_chunks
             WHERE page_id = ?
               AND source_id IS NULL`
        )
        .all<{ id: string; ordinal: number; section: string }>(page.id)) {
        if (!currentKeys.has(`${existing.section}:${existing.ordinal}`)) {
            await db.prepare('DELETE FROM cortex_chunks WHERE id = ?').run(existing.id);
        }
    }
}
