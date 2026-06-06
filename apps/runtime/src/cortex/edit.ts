import type {
    CortexEditPageInput,
    CortexEditPageResult,
    CortexSourceRef,
    CortexUpsertPageInput,
} from '@tavern/api';
import { writeCortexAudit } from './audit';
import { getActiveCortexSchema, isKnownCortexLinkType } from './cortex-schema';
import type { CortexDatabase } from './db';
import { createCortexId, hashText, slugifyCortexTitle } from './ids';
import {
    deleteCanonicalCortexMarkdownDraft,
    writeCanonicalCortexMarkdownDraft,
} from './markdown-file';
import { findPageRow, getCortexPage } from './read';
import {
    type ClaimRow,
    nowIso,
    type PageRow,
    readJsonArray,
    readJsonRecord,
    type TimelineRow,
} from './rows';
import { addCortexSchemaTerm } from './schema-additions';
import { syncCortexMarkdown } from './sync';

export async function editCortexPage(
    db: CortexDatabase,
    input: CortexEditPageInput
): Promise<CortexEditPageResult> {
    const now = nowIso();
    const sourceRef = sourceRefFromPageWrite(input.source);
    const pageIds = new Set<string>();
    const summary = input.summary ?? `Cortex page ${input.action}.`;

    if (input.action === 'noop') {
        const auditId = await writeCortexAudit(db, {
            kind: 'page.noop',
            metadata: { reason: input.reason },
            recordRefs: [],
            sourceRefs: [sourceRef],
            status: 'skipped',
            summary: input.reason,
        });
        return { auditId, pages: [] };
    }

    if (input.action === 'upsert') {
        pageIds.add(await upsertPage(db, input, [sourceRef], now));
    }

    if (input.action === 'archive') {
        const page = await requirePage(db, input.slugOrId);
        const draft = await pageDraftFromExisting(db, page.id);
        writePageDraft({
            ...draft,
            sourceRefs: uniqueSourceRefs([
                ...readJsonArray<CortexSourceRef>(page.source_refs_json),
                sourceRef,
            ]),
            status: 'archived',
            timeline: [
                ...draft.timeline,
                { body: summary, createdAt: now, sourceRefs: [sourceRef] },
            ],
            updatedAt: now,
        });
        await syncCortexMarkdown(db);
        pageIds.add(page.id);
    }

    if (input.action === 'delete') {
        const page = await requirePage(db, input.slugOrId);
        await deletePage(db, page, now);
        pageIds.add(page.id);
    }

    if (input.action === 'merge') {
        const source = await requirePage(db, input.sourceSlugOrId);
        const target = await requirePage(db, input.targetSlugOrId);
        const targetDraft = await pageDraftFromExisting(db, target.id);
        const sourceDraft = await pageDraftFromExisting(db, source.id);
        writePageDraft({
            ...targetDraft,
            aliases: uniqueStrings([...targetDraft.aliases, source.slug, ...sourceDraft.aliases]),
            body: [targetDraft.body, sourceDraft.body].filter(Boolean).join('\n\n'),
            sourceRefs: uniqueSourceRefs([
                ...targetDraft.sourceRefs,
                ...sourceDraft.sourceRefs,
                sourceRef,
            ]),
            timeline: [
                ...targetDraft.timeline,
                ...sourceDraft.timeline,
                {
                    body: `Merged ${source.title} into ${target.title}.`,
                    createdAt: now,
                    sourceRefs: [sourceRef],
                },
            ],
            updatedAt: now,
        });
        writePageDraft({
            ...sourceDraft,
            frontmatter: {
                ...sourceDraft.frontmatter,
                merged_into: target.slug,
                same_as: uniqueStrings([
                    ...readStringArray(sourceDraft.frontmatter.same_as),
                    target.slug,
                ]),
            },
            sourceRefs: uniqueSourceRefs([...sourceDraft.sourceRefs, sourceRef]),
            status: 'archived',
            timeline: [
                ...sourceDraft.timeline,
                {
                    body: `Merged into ${target.title}.`,
                    createdAt: now,
                    sourceRefs: [sourceRef],
                },
            ],
            updatedAt: now,
        });
        await syncCortexMarkdown(db);
        pageIds.add(source.id);
        pageIds.add(target.id);
    }

    if (input.action === 'split') {
        const source = await requirePage(db, input.sourceSlugOrId);
        for (const page of input.pages) {
            pageIds.add(
                await upsertPage(
                    db,
                    {
                        ...page,
                        action: 'upsert',
                        source: input.source,
                        summary: input.summary,
                    },
                    [sourceRef],
                    now
                )
            );
        }
        const sourceDraft = await pageDraftFromExisting(db, source.id);
        writePageDraft({
            ...sourceDraft,
            sourceRefs: uniqueSourceRefs([...sourceDraft.sourceRefs, sourceRef]),
            timeline: [
                ...sourceDraft.timeline,
                {
                    body: `Split into ${input.pages.length} Cortex page(s).`,
                    createdAt: now,
                    sourceRefs: [sourceRef],
                },
            ],
            updatedAt: now,
        });
        await syncCortexMarkdown(db);
        pageIds.add(source.id);
    }

    const auditId = await writeCortexAudit(db, {
        kind: `page.${input.action}`,
        metadata: { action: input.action },
        recordRefs: [...pageIds],
        sourceRefs: [sourceRef],
        status: 'success',
        summary,
    });

    return {
        auditId,
        pages: (
            await Promise.all([...pageIds].map(async (pageId) => await getCortexPage(db, pageId)))
        ).filter((page): page is NonNullable<typeof page> => Boolean(page)),
    };
}

async function deletePage(
    db: CortexDatabase,
    page: Awaited<ReturnType<typeof requirePage>>,
    now: string
): Promise<void> {
    deleteCanonicalCortexMarkdownDraft(page.slug);
    await db.transaction(async (tx) => {
        await tx
            .prepare(
                `DELETE FROM cortex_encodings
                 WHERE chunk_id IN (SELECT id FROM cortex_chunks WHERE page_id = ?)`
            )
            .run(page.id);
        await tx.prepare('DELETE FROM cortex_chunks WHERE page_id = ?').run(page.id);
        await tx.prepare('DELETE FROM cortex_claims WHERE page_id = ?').run(page.id);
        await tx.prepare('DELETE FROM cortex_timeline_entries WHERE page_id = ?').run(page.id);
        await tx.prepare('DELETE FROM cortex_page_aliases WHERE page_id = ?').run(page.id);
        await tx
            .prepare(
                `DELETE FROM cortex_links
                 WHERE from_page_id = ? OR target_page_id = ? OR target_slug = ?`
            )
            .run(page.id, page.id, page.slug);
        await tx
            .prepare(
                `UPDATE cortex_pages
                 SET status = 'deleted',
                     compiled_truth = '',
                     body = '',
                     frontmatter_json = '{}',
                     source_refs_json = '[]',
                     content_hash = '',
                     updated_at = ?,
                     deleted_at = ?
                 WHERE id = ?`
            )
            .run(now, now, page.id);
    });
}

async function upsertPage(
    db: CortexDatabase,
    input: CortexUpsertPageInput,
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<string> {
    const schema = await getActiveCortexSchema(db);
    const slug = slugifyCortexTitle(input.slug ?? input.title);
    const existing = await findEditablePageRow(db, slug);
    const existingDraft = existing
        ? existing.deleted_at
            ? null
            : await pageDraftFromExisting(db, existing.id)
        : null;
    const id = existing?.id ?? createCortexId('ctxp');
    const type = input.type ?? existingDraft?.type ?? 'note';
    if (!schema.pageTypes.includes(type)) {
        await addCortexSchemaTerm(db, {
            example: {
                slug,
                title: input.title,
            },
            kind: 'page-type',
            name: type,
            reason: `A Cortex page edit introduced page type "${type}".`,
            sourceRefs,
        });
    }
    const frontmatter = {
        ...(existingDraft?.frontmatter ?? {}),
        ...(input.frontmatter ?? {}),
    };
    for (const link of input.links ?? []) {
        if (!isKnownCortexLinkType(schema, link.linkKind)) {
            await addCortexSchemaTerm(db, {
                example: {
                    sourceSlug: slug,
                    targetSlug: link.targetSlug,
                },
                kind: 'link-type',
                name: link.linkKind,
                reason: `A Cortex page edit introduced link type "${link.linkKind}".`,
                sourceRefs,
            });
        }
        frontmatter[link.linkKind] = uniqueStrings([
            ...readStringArray(frontmatter[link.linkKind]),
            slugifyCortexTitle(link.targetSlug),
        ]);
    }
    writePageDraft({
        aliases: input.aliases ?? existingDraft?.aliases ?? [],
        body: input.body ?? existingDraft?.body ?? '',
        compiledTruth: input.compiledTruth ?? existingDraft?.compiledTruth ?? input.body ?? '',
        frontmatter,
        id,
        slug,
        sourceRefs: uniqueSourceRefs([...(existingDraft?.sourceRefs ?? []), ...sourceRefs]),
        status: input.status ?? existingDraft?.status ?? 'active',
        tags: input.tags ?? existingDraft?.tags ?? [],
        timeline: [
            ...(existingDraft?.timeline ?? []),
            ...(input.timelineEntries ?? []).map((entry) =>
                typeof entry === 'string'
                    ? {
                          body: entry,
                          createdAt: now,
                          sourceRefs,
                      }
                    : {
                          body: entry.body,
                          createdAt: entry.createdAt,
                          sourceRefs,
                      }
            ),
        ],
        title: input.title,
        type,
        updatedAt: now,
    });
    await syncCortexMarkdown(db);
    for (const claim of input.claims ?? []) {
        await upsertClaimWithContradiction(db, id, claim, sourceRefs, now);
    }
    return id;
}

async function upsertClaimWithContradiction(
    db: CortexDatabase,
    pageId: string,
    claim: NonNullable<CortexUpsertPageInput['claims']>[number],
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<void> {
    const prior = await db
        .prepare(
            `SELECT *
             FROM cortex_claims
             WHERE page_id = $pageId
               AND subject = $subject
               AND predicate = $predicate
               AND status = 'active'
               AND value != $value
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get<ClaimRow>({
            pageId,
            predicate: claim.predicate,
            subject: claim.subject,
            value: claim.value,
        });
    const supersedesClaimId = claim.supersedesClaimId ?? prior?.id ?? null;
    const status = claim.status ?? 'active';
    if (prior && status === 'active') {
        await db
            .prepare("UPDATE cortex_claims SET status = 'superseded', updated_at = ? WHERE id = ?")
            .run(now, prior.id);
    }
    const id = `ctxcl_${hashText(`${pageId}:${claim.subject}:${claim.predicate}:${claim.value}`).slice(0, 24)}`;
    await db
        .prepare(
            `INSERT INTO cortex_claims
             (id, page_id, subject, predicate, value, confidence, status, source_refs_json, supersedes_claim_id, created_at, updated_at)
             VALUES ($id, $pageId, $subject, $predicate, $value, $confidence, $status, $sourceRefs, $supersedesClaimId, $createdAt, $updatedAt)
             ON CONFLICT(id) DO UPDATE SET
               confidence = excluded.confidence,
               status = excluded.status,
               source_refs_json = excluded.source_refs_json,
               supersedes_claim_id = excluded.supersedes_claim_id,
               updated_at = excluded.updated_at`
        )
        .run({
            confidence: claim.confidence ?? null,
            createdAt: now,
            id,
            pageId,
            predicate: claim.predicate,
            sourceRefs: JSON.stringify(sourceRefs),
            status,
            subject: claim.subject,
            supersedesClaimId,
            updatedAt: now,
            value: claim.value,
        });
}

function writePageDraft(input: {
    aliases: string[];
    body: string;
    compiledTruth: string;
    frontmatter: Record<string, unknown>;
    id: string;
    slug: string;
    sourceRefs: CortexSourceRef[];
    status: 'active' | 'archived' | 'deleted' | 'stale';
    tags: string[];
    timeline: Array<{
        body: string;
        createdAt: string;
        sourceRefs?: CortexSourceRef[];
    }>;
    title: string;
    type: string;
    updatedAt: string;
}): void {
    writeCanonicalCortexMarkdownDraft(input);
}

async function pageDraftFromExisting(db: CortexDatabase, pageId: string) {
    const page = await requirePage(db, pageId);
    const frontmatter = readJsonRecord(page.frontmatter_json);
    return {
        aliases: readStringArray(frontmatter.aliases),
        body: page.body,
        compiledTruth: page.compiled_truth,
        frontmatter,
        id: page.id,
        slug: page.slug,
        sourceRefs: readJsonArray<CortexSourceRef>(page.source_refs_json),
        status: page.status,
        tags: readStringArray(frontmatter.tags),
        timeline: await listTimelineDrafts(db, page.id),
        title: page.title,
        type: page.type,
    };
}

async function requirePage(db: CortexDatabase, slugOrId: string) {
    const page = await findPageRow(db, slugOrId);
    if (!page) {
        throw new Error(`Cortex page not found: ${slugOrId}.`);
    }
    return page;
}

async function findEditablePageRow(
    db: CortexDatabase,
    slug: string
): Promise<(PageRow & { deleted_at: string | null }) | null> {
    return (
        (await db
            .prepare('SELECT * FROM cortex_pages WHERE slug = ? LIMIT 1')
            .get<PageRow & { deleted_at: string | null }>(slug)) ?? null
    );
}

async function listTimelineDrafts(
    db: CortexDatabase,
    pageId: string
): Promise<Array<{ body: string; createdAt: string; sourceRefs: CortexSourceRef[] }>> {
    return (
        await db
            .prepare(
                `SELECT body, created_at, source_refs_json
                 FROM cortex_timeline_entries
                 WHERE page_id = ?
                 ORDER BY created_at ASC`
            )
            .all<TimelineRow>(pageId)
    ).map((row) => ({
        body: row.body,
        createdAt: row.created_at,
        sourceRefs: readJsonArray<CortexSourceRef>(row.source_refs_json),
    }));
}

function sourceRefFromPageWrite(input: CortexEditPageInput['source']): CortexSourceRef {
    const locator =
        input.messageId ??
        input.fileId ??
        input.url ??
        input.turnId ??
        input.sessionKey ??
        input.chatId ??
        input.actorId;
    return {
        id: `ctxs_${hashText(JSON.stringify(input)).slice(0, 24)}`,
        kind: input.actorKind,
        locator,
    };
}

function uniqueSourceRefs(sourceRefs: CortexSourceRef[]): CortexSourceRef[] {
    const seen = new Set<string>();
    return sourceRefs.filter((sourceRef) => {
        const key = `${sourceRef.kind}:${sourceRef.locator ?? ''}:${sourceRef.id}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}
