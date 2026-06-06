import type { CortexIngestInput, CortexIngestResult, CortexSourceRef } from '@tavern/api';
import { writeCortexAudit } from './audit';
import { getActiveCortexSchema } from './cortex-schema';
import type { CortexDatabase } from './db';
import { createCortexId, hashText, slugifyCortexTitle } from './ids';
import { writeCanonicalCortexMarkdownDraft } from './markdown-file';
import { getCortexPage } from './read';
import { nowIso } from './rows';
import { addCortexSchemaTerm } from './schema-additions';
import { syncCortexMarkdown } from './sync';

export async function ingestCortexSource(
    db: CortexDatabase,
    input: CortexIngestInput
): Promise<CortexIngestResult> {
    const now = nowIso();
    const content = input.content.trim();
    const kind = input.kind.trim();
    const locator = normalizeLocator(input.locator, content);
    const sourceRef: CortexSourceRef = {
        id: `ctxs_${hashText(`${kind}:${locator}`).slice(0, 24)}`,
        kind,
        locator,
    };
    const title = input.title?.trim() || deriveIngestTitle(kind, locator, content);
    const slug = slugifyCortexTitle(title);
    const type = input.type ?? 'source';
    await ensureIngestPageType(db, type, sourceRef, title);
    await upsertCortexSource(db, {
        kind,
        locator,
        metadata: input.metadata ?? {},
        now,
        sourceRef,
    });

    writeCanonicalCortexMarkdownDraft({
        aliases: [],
        body: content,
        compiledTruth: content,
        frontmatter: {
            ingest_kind: kind,
            ingest_locator: locator,
            metadata: input.metadata ?? {},
            scope: {},
            tags: input.tags ?? [],
        },
        id: createCortexId('ctxp'),
        slug,
        sourceRefs: [sourceRef],
        status: 'active',
        tags: input.tags ?? [],
        timeline: [
            {
                body: `Ingested ${kind} source.`,
                createdAt: now,
                sourceRefs: [sourceRef],
            },
        ],
        title,
        type,
        updatedAt: now,
    });
    await syncCortexMarkdown(db);
    const page = await getCortexPage(db, slug);
    if (!page) {
        throw new Error('Cortex ingest projection did not return a page.');
    }
    const auditId = await writeCortexAudit(db, {
        kind: 'ingest',
        metadata: {
            actor: input.actor ?? null,
            ingestKind: kind,
            locator,
            metadata: input.metadata ?? {},
        },
        recordRefs: [page.id],
        sourceRefs: [sourceRef],
        status: 'success',
        summary: `Ingested ${title}.`,
    });
    return { auditId, page, sourceRef };
}

async function ensureIngestPageType(
    db: CortexDatabase,
    type: string,
    sourceRef: CortexSourceRef,
    title: string
): Promise<void> {
    const schema = await getActiveCortexSchema(db);
    if (schema.pageTypes.includes(type)) {
        return;
    }
    await addCortexSchemaTerm(db, {
        example: { title },
        kind: 'page-type',
        name: type,
        reason: `A Cortex ingest introduced page type "${type}".`,
        sourceRefs: [sourceRef],
    });
}

async function upsertCortexSource(
    db: CortexDatabase,
    input: {
        kind: string;
        locator: string;
        metadata: Record<string, unknown>;
        now: string;
        sourceRef: CortexSourceRef;
    }
): Promise<void> {
    await db
        .prepare(
            `INSERT INTO cortex_sources
             (id, kind, locator, hash, metadata_json, created_at, updated_at)
             VALUES ($id, $kind, $locator, $hash, $metadata, $createdAt, $updatedAt)
             ON CONFLICT(kind, locator) DO UPDATE SET
               hash = excluded.hash,
               metadata_json = excluded.metadata_json,
               updated_at = excluded.updated_at`
        )
        .run({
            createdAt: input.now,
            hash: hashText(`${input.kind}:${input.locator}`),
            id: input.sourceRef.id,
            kind: input.kind,
            locator: input.locator,
            metadata: JSON.stringify(input.metadata),
            updatedAt: input.now,
        });
}

function normalizeLocator(locator: string | undefined, content: string): string {
    const trimmed = locator?.trim();
    return trimmed || `content:${hashText(content).slice(0, 24)}`;
}

function deriveIngestTitle(kind: string, locator: string, content: string): string {
    const locatorTail = locator.split('/').filter(Boolean).at(-1);
    const fallback = content.replace(/\s+/gu, ' ').slice(0, 60);
    return `${kind}: ${locatorTail || fallback || 'source'}`;
}
