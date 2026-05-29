import type {
    CortexCaptureInput,
    CortexCaptureResult,
    CortexPage,
    CortexSourceRef,
} from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { createCortexId, hashText, slugifyCortexTitle } from './ids';
import { writeCanonicalCortexMarkdownDraft } from './markdown-file';
import { findPageRow, getCortexPage, toPage } from './read';
import {
    nowIso,
    readJsonArray,
    readJsonRecord,
    readStringArray,
    sourceRefFromCapture,
    type TimelineRow,
} from './rows';
import { syncCortexMarkdown } from './sync';

export function captureCortex(db: Database, input: CortexCaptureInput): CortexCaptureResult {
    const now = nowIso();
    const sourceRefs = [sourceRefFromCapture(input)];
    const captureKey = hashText(
        JSON.stringify({
            sourceRefs,
            title: input.title,
            type: input.type,
        })
    );
    const existingCapture = findCapture(db, captureKey);
    if (existingCapture?.status === 'success') {
        const pageRow = findPageRow(db, existingCapture.pageId);
        if (pageRow && isSameCaptureContent(pageRow, input)) {
            const page = getCortexPage(db, existingCapture.pageId);
            if (!page) {
                throw new Error('Cortex capture points at a missing page.');
            }
            return { auditId: existingCapture.auditId, page };
        }
    }

    const page = writePageMarkdownThenProject(db, input, sourceRefs, now);
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

function writePageMarkdownThenProject(
    db: Database,
    input: CortexCaptureInput,
    sourceRefs: CortexSourceRef[],
    now: string
): CortexPage {
    const slug = slugifyCortexTitle(input.title);
    const existing = findPageRow(db, slug);
    const id = existing?.id ?? createCortexId('ctxp');
    const compiledTruth = input.content.trim();
    const frontmatter = { aliases: [], scope: memoryScopeFromCapture(input), tags: input.tags };
    const existingSourceRefs = existing
        ? readJsonArray<CortexSourceRef>(existing.source_refs_json)
        : [];
    const allSourceRefs = uniqueSourceRefs([...existingSourceRefs, ...sourceRefs]);
    const timeline = [
        ...listTimelineDrafts(db, existing?.id),
        { body: `Captured: ${input.title}`, createdAt: now, sourceRefs },
    ];
    writeCanonicalCortexMarkdownDraft({
        aliases: [],
        body: input.content,
        compiledTruth,
        frontmatter,
        id,
        slug,
        sourceRefs: allSourceRefs,
        status: 'active',
        tags: input.tags,
        timeline,
        title: input.title,
        type: input.type,
        updatedAt: now,
    });
    syncCortexMarkdown(db);
    const page = findPageRow(db, id) ?? findPageRow(db, slug);
    if (!page) {
        throw new Error('Cortex markdown projection did not return a page.');
    }
    replaceClaims(db, page.id, input, sourceRefs, now);
    return toPage(db, findPageRow(db, id) ?? page);
}

function isSameCaptureContent(
    pageRow: NonNullable<ReturnType<typeof findPageRow>>,
    input: CortexCaptureInput
): boolean {
    const frontmatter = readJsonRecord(pageRow.frontmatter_json);
    return (
        pageRow.compiled_truth.trim() === input.content.trim() &&
        pageRow.body.trim() === input.content.trim() &&
        pageRow.type === input.type &&
        sameStringSet(readStringArray(frontmatter.tags), input.tags)
    );
}

function sameStringSet(left: string[], right: string[]): boolean {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
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

function listTimelineDrafts(
    db: Database,
    pageId: string | undefined
): Array<{ body: string; createdAt: string; sourceRefs: CortexSourceRef[] }> {
    if (!pageId) {
        return [];
    }
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

type CaptureLookup = null | { auditId: string; pageId: string; status: string };

function memoryScopeFromCapture(input: CortexCaptureInput): Record<string, string> {
    const scope = {
        agentId: input.source.agentId,
        chatId: input.source.chatId,
        participantId: input.source.participantId,
        profileId: input.source.profileId,
    };

    return Object.fromEntries(
        Object.entries(scope).filter(
            (entry): entry is [string, string] =>
                typeof entry[1] === 'string' && entry[1].trim().length > 0
        )
    );
}

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
