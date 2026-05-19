import type {
    CortexCaptureInput,
    CortexCaptureResult,
    CortexPage,
    CortexSourceRef,
} from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { refreshDerivedPageState } from './derive';
import { createCortexId, hashText, slugifyCortexTitle } from './ids';
import { writeMarkdownMirror } from './mirror';
import { findPageRow, getCortexPage, toPage } from './read';
import { nowIso, sourceRefFromCapture } from './rows';

export function captureCortex(db: Database, input: CortexCaptureInput): CortexCaptureResult {
    const now = nowIso();
    const sourceRefs = [sourceRefFromCapture(input)];
    upsertSource(db, sourceRefs[0], now);
    const captureKey = hashText(
        JSON.stringify({
            content: input.content,
            sourceRefs,
            tags: input.tags,
            title: input.title,
            type: input.type,
        })
    );
    const existingCapture = findCapture(db, captureKey);
    if (existingCapture?.status === 'success') {
        const page = getCortexPage(db, existingCapture.pageId);
        if (page) {
            return { auditId: existingCapture.auditId, page };
        }
    }

    const page = upsertPage(db, input, sourceRefs, now);
    const auditId = writeCortexAudit(db, {
        kind: 'capture',
        recordRefs: [page.id],
        sourceRefs,
        status: 'success',
        summary: `Captured ${page.title}.`,
    });
    upsertCapture(db, captureKey, page.id, auditId, sourceRefs, now);
    return { auditId, page };
}

function upsertSource(db: Database, sourceRef: CortexSourceRef, now: string): void {
    db.prepare(
        `INSERT INTO cortex_sources
         (id, kind, locator, hash, metadata_json, created_at, updated_at)
         VALUES ($id, $kind, $locator, $hash, '{}', $createdAt, $updatedAt)
         ON CONFLICT(kind, locator) DO UPDATE SET
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            createdAt: now,
            hash: hashText(`${sourceRef.kind}:${sourceRef.locator ?? ''}`),
            id: sourceRef.id,
            kind: sourceRef.kind,
            locator: sourceRef.locator,
            updatedAt: now,
        })
    );
}

function upsertPage(
    db: Database,
    input: CortexCaptureInput,
    sourceRefs: CortexSourceRef[],
    now: string
): CortexPage {
    const slug = slugifyCortexTitle(input.title);
    const existing = findPageRow(db, slug);
    const id = existing?.id ?? createCortexId('ctxp');
    const compiledTruth = input.content.trim();
    const frontmatter = { aliases: [], tags: input.tags };
    const contentHash = hashText(`${compiledTruth}\n${input.content}`);

    if (existing) {
        updatePage(db, { compiledTruth, contentHash, frontmatter, id, input, sourceRefs, now });
    } else {
        insertPage(db, {
            compiledTruth,
            contentHash,
            frontmatter,
            id,
            input,
            slug,
            sourceRefs,
            now,
        });
    }

    const page = findPageRow(db, id);
    if (!page) {
        throw new Error('Cortex page write did not return a page.');
    }
    appendTimeline(db, page.id, `Captured: ${input.title}`, sourceRefs, now);
    replaceClaims(db, page.id, input, sourceRefs, now);
    refreshDerivedPageState(db, page, now);
    const fullPage = toPage(db, findPageRow(db, id) ?? page);
    writeMarkdownMirror(fullPage);
    return fullPage;
}

function updatePage(
    db: Database,
    input: {
        compiledTruth: string;
        contentHash: string;
        frontmatter: Record<string, unknown>;
        id: string;
        input: CortexCaptureInput;
        now: string;
        sourceRefs: CortexSourceRef[];
    }
): void {
    db.prepare(
        `UPDATE cortex_pages
         SET title = $title,
             type = $type,
             status = 'active',
             compiled_truth = $compiledTruth,
             body = $body,
             frontmatter_json = $frontmatter,
             source_refs_json = $sourceRefs,
             content_hash = $contentHash,
             updated_at = $updatedAt,
             deleted_at = NULL
         WHERE id = $id`
    ).run(
        namedParams({
            body: input.input.content,
            compiledTruth: input.compiledTruth,
            contentHash: input.contentHash,
            frontmatter: JSON.stringify(input.frontmatter),
            id: input.id,
            sourceRefs: JSON.stringify(input.sourceRefs),
            title: input.input.title,
            type: input.input.type,
            updatedAt: input.now,
        })
    );
}

function insertPage(
    db: Database,
    input: {
        compiledTruth: string;
        contentHash: string;
        frontmatter: Record<string, unknown>;
        id: string;
        input: CortexCaptureInput;
        now: string;
        slug: string;
        sourceRefs: CortexSourceRef[];
    }
): void {
    db.prepare(
        `INSERT INTO cortex_pages
         (id, slug, title, type, status, compiled_truth, body, frontmatter_json,
          source_refs_json, content_hash, created_at, updated_at)
         VALUES ($id, $slug, $title, $type, 'active', $compiledTruth, $body,
          $frontmatter, $sourceRefs, $contentHash, $createdAt, $updatedAt)`
    ).run(
        namedParams({
            body: input.input.content,
            compiledTruth: input.compiledTruth,
            contentHash: input.contentHash,
            createdAt: input.now,
            frontmatter: JSON.stringify(input.frontmatter),
            id: input.id,
            slug: input.slug,
            sourceRefs: JSON.stringify(input.sourceRefs),
            title: input.input.title,
            type: input.input.type,
            updatedAt: input.now,
        })
    );
}

function replaceClaims(
    db: Database,
    pageId: string,
    input: CortexCaptureInput,
    sourceRefs: CortexSourceRef[],
    now: string
): void {
    db.prepare('DELETE FROM cortex_claims WHERE page_id = ?').run(pageId);
    const sentences = input.content
        .split(/(?<=[.!?])\s+/u)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .slice(0, 20);

    for (const sentence of sentences) {
        db.prepare(
            `INSERT INTO cortex_claims
             (id, page_id, subject, predicate, value, confidence, status, source_refs_json, created_at, updated_at)
             VALUES ($id, $pageId, $subject, 'states', $value, 0.6, 'active', $sourceRefs, $createdAt, $updatedAt)`
        ).run(
            namedParams({
                createdAt: now,
                id: createCortexId('ctxcl'),
                pageId,
                sourceRefs: JSON.stringify(sourceRefs),
                subject: input.title,
                updatedAt: now,
                value: sentence,
            })
        );
    }
}

function appendTimeline(
    db: Database,
    pageId: string,
    body: string,
    sourceRefs: CortexSourceRef[],
    now: string
): void {
    db.prepare(
        `INSERT INTO cortex_timeline_entries
         (id, page_id, body, source_refs_json, created_at)
         VALUES ($id, $pageId, $body, $sourceRefs, $createdAt)`
    ).run(
        namedParams({
            body,
            createdAt: now,
            id: createCortexId('ctxt'),
            pageId,
            sourceRefs: JSON.stringify(sourceRefs),
        })
    );
}

function upsertCapture(
    db: Database,
    captureKey: string,
    pageId: string,
    auditId: string,
    sourceRefs: CortexSourceRef[],
    now: string
): void {
    db.prepare(
        `INSERT INTO cortex_captures
         (id, capture_key, status, source_refs_json, output_refs_json, attempts, created_at, updated_at)
         VALUES ($id, $captureKey, 'success', $sourceRefs, $outputRefs, 1, $createdAt, $updatedAt)
         ON CONFLICT(capture_key) DO UPDATE SET
            status = 'success',
            output_refs_json = excluded.output_refs_json,
            attempts = attempts + 1,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            captureKey,
            createdAt: now,
            id: createCortexId('ctxcap'),
            outputRefs: JSON.stringify([{ auditId, id: pageId, kind: 'page' }]),
            sourceRefs: JSON.stringify(sourceRefs),
            updatedAt: now,
        })
    );
}

type CaptureLookup = null | { auditId: string; pageId: string; status: string };

function findCapture(db: Database, captureKey: string): CaptureLookup {
    const row = db
        .prepare(
            `SELECT status, output_refs_json
             FROM cortex_captures
             WHERE capture_key = ?
             LIMIT 1`
        )
        .get(captureKey) as { output_refs_json: string; status: string } | null;
    if (!row) {
        return null;
    }
    const refs = JSON.parse(row.output_refs_json) as Array<{ auditId?: string; id?: string }>;
    return {
        auditId: refs[0]?.auditId ?? '',
        pageId: refs[0]?.id ?? '',
        status: row.status,
    };
}
