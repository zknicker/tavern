import type { CortexSourceRef } from '@tavern/api';
import { getActiveCortexSchema, isKnownCortexLinkType } from './cortex-schema';
import type { CortexDatabase } from './db';
import type {
    DreamApplyResult,
    DreamCitation,
    DreamNoop,
    DreamObservation,
    DreamPageWrite,
    DreamProposal,
    DreamRelationship,
    DreamSourceRange,
    DreamTimelineEntry,
    DreamWarning,
} from './dream-types';
import { createCortexId, hashText, slugifyCortexTitle } from './ids';
import { writeCanonicalCortexMarkdownDraft } from './markdown-file';
import { findPageRow } from './read';
import { nowIso, readJsonArray, readJsonRecord, type TimelineRow } from './rows';
import { addCortexSchemaTerm } from './schema-additions';
import { syncCortexMarkdown } from './sync';

export async function applyDreamProposal(
    db: CortexDatabase,
    input: {
        model: string;
        origin?: {
            frontmatterKey: string;
            relationshipSourceLocation: string;
            tag: string;
        };
        outputHash: string;
        promptHash: string;
        proposal: DreamProposal;
        sourceRange: DreamSourceRange;
    }
): Promise<DreamApplyResult> {
    const now = nowIso();
    const origin = input.origin ?? {
        frontmatterKey: 'dream',
        relationshipSourceLocation: 'dream',
        tag: 'dream',
    };
    const schema = await getActiveCortexSchema(db);
    const warnings: DreamWarning[] = [...input.proposal.warnings];
    const noops: DreamNoop[] = [...input.proposal.noops];
    const touchedPageIds = new Set<string>();
    const pageWriteSlugs = new Set<string>();
    const relationships: DreamRelationship[] = [];
    for (const relationship of input.proposal.relationships) {
        if (!isKnownCortexLinkType(schema, relationship.linkKind)) {
            await addCortexSchemaTerm(db, {
                example: {
                    sourceSlug: relationship.fromSlug,
                    targetSlug: relationship.targetSlug,
                },
                kind: 'link-type',
                name: relationship.linkKind,
                reason: `Cortex Dream introduced link type "${relationship.linkKind}".`,
                sourceRefs: input.sourceRange.sourceRefs,
            });
        }
        relationships.push(relationship);
    }

    await upsertSourceRefs(db, input.sourceRange.sourceRefs, now);

    for (const pageWrite of input.proposal.pageWrites) {
        const normalized = normalizePageWrite(pageWrite);
        if (!schema.pageTypes.includes(normalized.type)) {
            await addCortexSchemaTerm(db, {
                example: {
                    slug: normalized.slug,
                    title: normalized.title,
                },
                kind: 'page-type',
                name: normalized.type,
                reason: `Cortex Dream introduced page type "${normalized.type}".`,
                sourceRefs: input.sourceRange.sourceRefs,
            });
        }
        if (normalized.action === 'archive') {
            const archived = await archivePage(db, normalized.slug, now);
            if (archived) {
                touchedPageIds.add(archived);
            }
            continue;
        }
        pageWriteSlugs.add(normalized.slug);
        touchedPageIds.add(
            await writeDreamPage(
                db,
                normalized,
                input.proposal.timelineEntries,
                relationships,
                origin,
                input.sourceRange,
                now
            )
        );
    }

    await writeStandaloneRelationshipPages(
        db,
        relationships,
        origin,
        input.sourceRange,
        pageWriteSlugs,
        now
    );

    await syncCortexMarkdown(db);

    for (const observation of input.proposal.observations) {
        const page = await findPageRow(db, observation.pageSlug);
        if (!page) {
            warnings.push({
                message: `Skipped observation for missing page ${observation.pageSlug}.`,
            });
            continue;
        }
        await upsertObservation(db, page.id, observation, input.sourceRange.sourceRefs, now);
        touchedPageIds.add(page.id);
    }

    for (const relationship of relationships) {
        const fromSlug = slugifyCortexTitle(relationship.fromSlug);
        if (pageWriteSlugs.has(fromSlug)) {
            continue;
        }
        const page = await findPageRow(db, fromSlug);
        if (page) {
            touchedPageIds.add(page.id);
            continue;
        }
        warnings.push({
            message: `Skipped relationship from missing page ${relationship.fromSlug}.`,
        });
    }

    for (const citation of input.proposal.citations) {
        const citationId = await insertCitation(db, citation, input.sourceRange.sourceRefs, now);
        if (citationId) {
            const page = await findPageRow(db, citation.pageSlug);
            if (page) {
                touchedPageIds.add(page.id);
            }
        } else {
            warnings.push({
                message: `Skipped citation for missing page ${citation.pageSlug}.`,
            });
        }
    }

    return {
        noops,
        outputHash: input.outputHash,
        pageIds: [...touchedPageIds],
        pagesTouched: touchedPageIds.size,
        promptHash: input.promptHash,
        warnings,
    };
}

function normalizePageWrite(pageWrite: DreamPageWrite): Required<
    Omit<DreamPageWrite, 'frontmatter'>
> & {
    frontmatter: Record<string, unknown>;
} {
    const slug = slugifyCortexTitle(pageWrite.slug || pageWrite.title);
    return {
        action: pageWrite.action ?? 'upsert',
        aliases: pageWrite.aliases ?? [],
        body: pageWrite.body ?? pageWrite.compiledTruth,
        compiledTruth: pageWrite.compiledTruth,
        frontmatter: pageWrite.frontmatter ?? {},
        slug,
        tags: pageWrite.tags ?? [],
        title: pageWrite.title,
        type: pageWrite.type ?? 'note',
    };
}

async function writeDreamPage(
    db: CortexDatabase,
    pageWrite: ReturnType<typeof normalizePageWrite>,
    timelineEntries: DreamTimelineEntry[],
    relationships: DreamRelationship[],
    origin: { frontmatterKey: string; tag: string },
    sourceRange: DreamSourceRange,
    now: string
): Promise<string> {
    const existing = await findPageRow(db, pageWrite.slug);
    const id = existing?.id ?? createCortexId('ctxp');
    const existingFrontmatter = existing ? readJsonRecord(existing.frontmatter_json) : {};
    const existingSourceRefs = existing
        ? readJsonArray<CortexSourceRef>(existing.source_refs_json)
        : [];
    const sourceRefs = uniqueSourceRefs([...existingSourceRefs, ...sourceRange.sourceRefs]);
    const timeline = [
        ...(await listTimelineDrafts(db, existing?.id)),
        ...timelineEntries
            .filter((entry) => slugifyCortexTitle(entry.pageSlug) === pageWrite.slug)
            .map((entry) => ({
                body: entry.body,
                createdAt: entry.createdAt ?? now,
                sourceRefs: sourceRange.sourceRefs,
            })),
    ];

    const frontmatter = mergeRelationshipFrontmatter(
        {
            ...existingFrontmatter,
            ...pageWrite.frontmatter,
            [origin.frontmatterKey]: {
                captureKey: sourceRange.captureKey,
                sourceHash: sourceRange.sourceHash,
            },
        },
        pageWrite.slug,
        relationships
    );

    writeCanonicalCortexMarkdownDraft({
        aliases: uniqueStrings([
            ...readStringArray(existingFrontmatter.aliases),
            ...pageWrite.aliases,
        ]),
        body: pageWrite.body,
        compiledTruth: pageWrite.compiledTruth,
        frontmatter,
        id,
        slug: pageWrite.slug,
        sourceRefs,
        status: pageWrite.action === 'archive' ? 'archived' : 'active',
        tags: uniqueStrings([
            ...readStringArray(existingFrontmatter.tags),
            ...pageWrite.tags,
            origin.tag,
        ]),
        timeline,
        title: pageWrite.title,
        type: pageWrite.type,
        updatedAt: now,
    });
    return id;
}

async function writeStandaloneRelationshipPages(
    db: CortexDatabase,
    relationships: DreamRelationship[],
    origin: { frontmatterKey: string; tag: string },
    sourceRange: DreamSourceRange,
    pageWriteSlugs: Set<string>,
    now: string
): Promise<void> {
    const fromSlugs = uniqueStrings(
        relationships
            .map((relationship) => slugifyCortexTitle(relationship.fromSlug))
            .filter((slug) => !pageWriteSlugs.has(slug))
    );

    for (const slug of fromSlugs) {
        const page = await findPageRow(db, slug);
        if (!page) {
            continue;
        }
        const existingFrontmatter = readJsonRecord(page.frontmatter_json);
        const sourceRefs = uniqueSourceRefs([
            ...readJsonArray<CortexSourceRef>(page.source_refs_json),
            ...sourceRange.sourceRefs,
        ]);
        const frontmatter = mergeRelationshipFrontmatter(
            {
                ...existingFrontmatter,
                [origin.frontmatterKey]: {
                    captureKey: sourceRange.captureKey,
                    sourceHash: sourceRange.sourceHash,
                },
            },
            page.slug,
            relationships
        );

        writeCanonicalCortexMarkdownDraft({
            aliases: readStringArray(existingFrontmatter.aliases),
            body: page.body,
            compiledTruth: page.compiled_truth,
            frontmatter,
            id: page.id,
            slug: page.slug,
            sourceRefs,
            status: page.status,
            tags: uniqueStrings([...readStringArray(existingFrontmatter.tags), origin.tag]),
            timeline: await listTimelineDrafts(db, page.id),
            title: page.title,
            type: page.type,
            updatedAt: now,
        });
    }
}

function mergeRelationshipFrontmatter(
    frontmatter: Record<string, unknown>,
    pageSlug: string,
    relationships: DreamRelationship[]
): Record<string, unknown> {
    const next = { ...frontmatter };
    for (const relationship of relationships) {
        if (slugifyCortexTitle(relationship.fromSlug) !== pageSlug) {
            continue;
        }
        const field = relationship.linkKind;
        next[field] = uniqueStrings([
            ...readStringArray(next[field]),
            slugifyCortexTitle(relationship.targetSlug),
        ]);
    }
    return next;
}

async function archivePage(db: CortexDatabase, slug: string, now: string): Promise<string | null> {
    const page = await findPageRow(db, slug);
    if (!page) {
        return null;
    }
    const frontmatter = readJsonRecord(page.frontmatter_json);
    writeCanonicalCortexMarkdownDraft({
        aliases: readStringArray(frontmatter.aliases),
        body: page.body,
        compiledTruth: page.compiled_truth,
        frontmatter,
        id: page.id,
        slug: page.slug,
        sourceRefs: readJsonArray<CortexSourceRef>(page.source_refs_json),
        status: 'archived',
        tags: readStringArray(frontmatter.tags),
        timeline: await listTimelineDrafts(db, page.id),
        title: page.title,
        type: page.type,
        updatedAt: now,
    });
    await db
        .prepare(
            `UPDATE cortex_pages
         SET status = 'archived',
             updated_at = $updatedAt
         WHERE id = $id`
        )
        .run({ id: page.id, updatedAt: now });
    return page.id;
}

async function upsertObservation(
    db: CortexDatabase,
    pageId: string,
    observation: DreamObservation,
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<void> {
    const valueHash = hashText(
        `${pageId}:${observation.subject}:${observation.predicate ?? 'states'}:${observation.value}`
    );
    const id = `ctxcl_${valueHash.slice(0, 24)}`;
    await db
        .prepare(
            `INSERT INTO cortex_claims
         (id, page_id, subject, predicate, value, confidence, status, source_refs_json, created_at, updated_at)
         VALUES ($id, $pageId, $subject, $predicate, $value, $confidence, $status, $sourceRefs, $createdAt, $updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           confidence = excluded.confidence,
           status = excluded.status,
           source_refs_json = excluded.source_refs_json,
           updated_at = excluded.updated_at`
        )
        .run({
            confidence: observation.confidence ?? 0.7,
            createdAt: now,
            id,
            pageId,
            predicate: observation.predicate ?? 'states',
            sourceRefs: JSON.stringify(sourceRefs),
            status: observation.status ?? 'active',
            subject: observation.subject,
            updatedAt: now,
            value: observation.value,
        });
}

async function upsertSourceRefs(
    db: CortexDatabase,
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<void> {
    for (const sourceRef of sourceRefs) {
        await db
            .prepare(
                `INSERT INTO cortex_sources
             (id, kind, locator, hash, metadata_json, created_at, updated_at)
             VALUES ($id, $kind, $locator, $hash, '{}', $createdAt, $updatedAt)
             ON CONFLICT(kind, locator) DO UPDATE SET updated_at = excluded.updated_at`
            )
            .run({
                createdAt: now,
                hash: hashText(`${sourceRef.kind}:${sourceRef.locator ?? ''}`),
                id: sourceRef.id,
                kind: sourceRef.kind,
                locator: sourceRef.locator,
                updatedAt: now,
            });
    }
}

async function insertCitation(
    db: CortexDatabase,
    citation: DreamCitation,
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<string | null> {
    const page = await findPageRow(db, citation.pageSlug);
    if (!page) {
        return null;
    }
    const sourceId = sourceRefs[0]?.id ?? null;
    const id = `ctxcite_${hashText(`${page.id}:${citation.locator}:${citation.quote ?? ''}`).slice(0, 24)}`;
    await db
        .prepare(
            `INSERT INTO cortex_citations
         (id, page_id, source_id, file_id, locator, quote, metadata_json, created_at)
         VALUES ($id, $pageId, $sourceId, NULL, $locator, $quote, $metadata, $createdAt)
         ON CONFLICT(id) DO NOTHING`
        )
        .run({
            createdAt: now,
            id,
            locator: citation.locator,
            metadata: JSON.stringify({
                sourceRefIds: sourceRefs.map((ref) => ref.id),
            }),
            pageId: page.id,
            quote: citation.quote ?? null,
            sourceId,
        });
    return id;
}

async function listTimelineDrafts(
    db: CortexDatabase,
    pageId: string | undefined
): Promise<Array<{ body: string; createdAt: string; sourceRefs: CortexSourceRef[] }>> {
    if (!pageId) {
        return [];
    }
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
