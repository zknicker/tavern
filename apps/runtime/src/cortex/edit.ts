import type {
    CortexEditPageInput,
    CortexEditPageResult,
    CortexSourceRef,
    CortexUpsertPageInput,
} from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { getActiveCortexSchema, isKnownCortexLinkType } from './cortex-schema';
import { createCortexId, hashText, slugifyCortexTitle } from './ids';
import { writeCanonicalCortexMarkdownDraft } from './markdown-file';
import { findPageRow, getCortexPage } from './read';
import { type ClaimRow, nowIso, readJsonArray, readJsonRecord, type TimelineRow } from './rows';
import { syncCortexMarkdown } from './sync';

export function editCortexPage(db: Database, input: CortexEditPageInput): CortexEditPageResult {
    const now = nowIso();
    const sourceRef = sourceRefFromPageWrite(input.source);
    const pageIds = new Set<string>();
    const summary = input.summary ?? `Cortex page ${input.action}.`;

    if (input.action === 'noop') {
        const auditId = writeCortexAudit(db, {
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
        pageIds.add(upsertPage(db, input, [sourceRef], now));
    }

    if (input.action === 'archive') {
        const page = requirePage(db, input.slugOrId);
        writePageDraft({
            ...pageDraftFromExisting(db, page.id),
            sourceRefs: uniqueSourceRefs([
                ...readJsonArray<CortexSourceRef>(page.source_refs_json),
                sourceRef,
            ]),
            status: 'archived',
            timeline: [
                ...listTimelineDrafts(db, page.id),
                { body: summary, createdAt: now, sourceRefs: [sourceRef] },
            ],
            updatedAt: now,
        });
        syncCortexMarkdown(db);
        pageIds.add(page.id);
    }

    if (input.action === 'merge') {
        const source = requirePage(db, input.sourceSlugOrId);
        const target = requirePage(db, input.targetSlugOrId);
        const targetDraft = pageDraftFromExisting(db, target.id);
        const sourceDraft = pageDraftFromExisting(db, source.id);
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
                { body: `Merged into ${target.title}.`, createdAt: now, sourceRefs: [sourceRef] },
            ],
            updatedAt: now,
        });
        syncCortexMarkdown(db);
        pageIds.add(source.id);
        pageIds.add(target.id);
    }

    if (input.action === 'split') {
        const source = requirePage(db, input.sourceSlugOrId);
        for (const page of input.pages) {
            pageIds.add(
                upsertPage(
                    db,
                    { ...page, action: 'upsert', source: input.source, summary: input.summary },
                    [sourceRef],
                    now
                )
            );
        }
        const sourceDraft = pageDraftFromExisting(db, source.id);
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
        syncCortexMarkdown(db);
        pageIds.add(source.id);
    }

    const auditId = writeCortexAudit(db, {
        kind: `page.${input.action}`,
        metadata: { action: input.action },
        recordRefs: [...pageIds],
        sourceRefs: [sourceRef],
        status: 'success',
        summary,
    });

    return {
        auditId,
        pages: [...pageIds].flatMap((pageId) => {
            const page = getCortexPage(db, pageId);
            return page ? [page] : [];
        }),
    };
}

function upsertPage(
    db: Database,
    input: CortexUpsertPageInput,
    sourceRefs: CortexSourceRef[],
    now: string
): string {
    const schema = getActiveCortexSchema(db);
    const slug = slugifyCortexTitle(input.slug ?? input.title);
    const existing = findPageRow(db, slug);
    const existingDraft = existing ? pageDraftFromExisting(db, existing.id) : null;
    const id = existing?.id ?? createCortexId('ctxp');
    const type = input.type ?? existingDraft?.type ?? 'note';
    if (!schema.pageTypes.includes(type)) {
        throw new Error(`Unknown Cortex page type: ${type}.`);
    }
    const frontmatter = { ...(existingDraft?.frontmatter ?? {}), ...(input.frontmatter ?? {}) };
    for (const link of input.links ?? []) {
        if (!isKnownCortexLinkType(schema, link.linkKind)) {
            throw new Error(`Unknown Cortex link type: ${link.linkKind}.`);
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
            ...(input.timelineEntries ?? []).map((body) => ({ body, createdAt: now, sourceRefs })),
        ],
        title: input.title,
        type,
        updatedAt: now,
    });
    syncCortexMarkdown(db);
    for (const claim of input.claims ?? []) {
        upsertClaimWithContradiction(db, id, claim, sourceRefs, now);
    }
    return id;
}

function upsertClaimWithContradiction(
    db: Database,
    pageId: string,
    claim: NonNullable<CortexUpsertPageInput['claims']>[number],
    sourceRefs: CortexSourceRef[],
    now: string
): void {
    const prior = db
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
        .get(
            namedParams({
                pageId,
                predicate: claim.predicate,
                subject: claim.subject,
                value: claim.value,
            })
        ) as ClaimRow | null;
    const supersedesClaimId = claim.supersedesClaimId ?? prior?.id ?? null;
    const status = claim.status ?? 'active';
    if (prior && status === 'active') {
        db.prepare(
            "UPDATE cortex_claims SET status = 'superseded', updated_at = ? WHERE id = ?"
        ).run(now, prior.id);
    }
    const id = `ctxcl_${hashText(`${pageId}:${claim.subject}:${claim.predicate}:${claim.value}`).slice(0, 24)}`;
    db.prepare(
        `INSERT INTO cortex_claims
         (id, page_id, subject, predicate, value, confidence, status, source_refs_json, supersedes_claim_id, created_at, updated_at)
         VALUES ($id, $pageId, $subject, $predicate, $value, $confidence, $status, $sourceRefs, $supersedesClaimId, $createdAt, $updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           confidence = excluded.confidence,
           status = excluded.status,
           source_refs_json = excluded.source_refs_json,
           supersedes_claim_id = excluded.supersedes_claim_id,
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
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
        })
    );
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
    timeline: Array<{ body: string; createdAt: string; sourceRefs?: CortexSourceRef[] }>;
    title: string;
    type: string;
    updatedAt: string;
}): void {
    writeCanonicalCortexMarkdownDraft({
        aliases: input.aliases,
        body: input.body,
        compiledTruth: input.compiledTruth,
        frontmatter: input.frontmatter,
        id: input.id,
        slug: input.slug,
        sourceRefs: input.sourceRefs,
        status: input.status,
        tags: input.tags,
        timeline: input.timeline,
        title: input.title,
        type: input.type,
        updatedAt: input.updatedAt,
    });
}

function pageDraftFromExisting(db: Database, pageId: string) {
    const page = requirePage(db, pageId);
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
        timeline: listTimelineDrafts(db, page.id),
        title: page.title,
        type: page.type,
    };
}

function requirePage(db: Database, slugOrId: string) {
    const page = findPageRow(db, slugOrId);
    if (!page) {
        throw new Error(`Cortex page not found: ${slugOrId}.`);
    }
    return page;
}

function listTimelineDrafts(
    db: Database,
    pageId: string
): Array<{ body: string; createdAt: string; sourceRefs: CortexSourceRef[] }> {
    return (
        db
            .prepare(
                `SELECT body, created_at, source_refs_json
                 FROM cortex_timeline_entries
                 WHERE page_id = ?
                 ORDER BY created_at ASC`
            )
            .all(pageId) as TimelineRow[]
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
