import type {
    CortexCaptureInput,
    CortexCaptureResult,
    CortexPage,
    CortexSourceRef,
} from '@tavern/api';
import { writeCortexAudit } from './audit';
import { getActiveCortexSchema } from './cortex-schema';
import type { CortexDatabase } from './db';
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
import { addCortexSchemaTerm } from './schema-additions';
import { syncCortexMarkdown } from './sync';

export async function captureCortex(
    db: CortexDatabase,
    input: CortexCaptureInput
): Promise<CortexCaptureResult> {
    const now = nowIso();
    const sourceRefs = [sourceRefFromCapture(input)];
    await ensureCapturePageType(db, input, sourceRefs);
    const normalizedInput = input;
    const captureKey = hashText(
        JSON.stringify({
            sourceRefs,
            title: normalizedInput.title,
            type: input.type,
        })
    );
    const existingCapture = await findCapture(db, captureKey);
    if (existingCapture?.status === 'success') {
        const pageRow = await findPageRow(db, existingCapture.pageId);
        if (pageRow && isSameCaptureContent(pageRow, normalizedInput)) {
            const page = await getCortexPage(db, existingCapture.pageId);
            if (!page) {
                throw new Error('Cortex capture points at a missing page.');
            }
            return { auditId: existingCapture.auditId, page };
        }
    }

    const page = await writePageMarkdownThenProject(db, normalizedInput, sourceRefs, now);
    const auditId = await writeCortexAudit(db, {
        kind: 'capture',
        recordRefs: [page.id],
        sourceRefs,
        status: 'success',
        summary: `Captured ${page.title}.`,
    });
    await upsertCapture(db, captureKey, page.id, auditId, sourceRefs, now);
    return { auditId, page };
}

async function ensureCapturePageType(
    db: CortexDatabase,
    input: CortexCaptureInput,
    sourceRefs: CortexSourceRef[]
): Promise<void> {
    const schema = await getActiveCortexSchema(db);
    if (schema.pageTypes.includes(input.type)) {
        return;
    }
    await addCortexSchemaTerm(db, {
        example: {
            title: input.title,
        },
        kind: 'page-type',
        name: input.type,
        reason: `A Cortex capture introduced page type "${input.type}".`,
        sourceRefs,
    });
}

async function writePageMarkdownThenProject(
    db: CortexDatabase,
    input: CortexCaptureInput,
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<CortexPage> {
    const slug = slugifyCortexTitle(input.title);
    const existing = await findPageRow(db, slug);
    const id = existing?.id ?? createCortexId('ctxp');
    const compiledTruth = input.content.trim();
    const frontmatter = {
        aliases: [],
        scope: memoryScopeFromCapture(input),
        tags: input.tags,
    };
    const existingSourceRefs = existing
        ? readJsonArray<CortexSourceRef>(existing.source_refs_json)
        : [];
    const allSourceRefs = uniqueSourceRefs([...existingSourceRefs, ...sourceRefs]);
    const timeline = [
        ...(await listTimelineDrafts(db, existing?.id)),
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
    await syncCortexMarkdown(db);
    const page = (await findPageRow(db, id)) ?? (await findPageRow(db, slug));
    if (!page) {
        throw new Error('Cortex markdown projection did not return a page.');
    }
    await replaceClaims(db, page.id, input, sourceRefs, now);
    return await toPage(db, (await findPageRow(db, id)) ?? page);
}

function isSameCaptureContent(
    pageRow: NonNullable<Awaited<ReturnType<typeof findPageRow>>>,
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
    db: CortexDatabase,
    pageId: string,
    input: CortexCaptureInput,
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<void> {
    return replaceClaimsAsync(db, pageId, input, sourceRefs, now);
}

async function replaceClaimsAsync(
    db: CortexDatabase,
    pageId: string,
    input: CortexCaptureInput,
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<void> {
    await db.prepare('DELETE FROM cortex_claims WHERE page_id = ?').run(pageId);
    const sentences = input.content
        .split(/(?<=[.!?])\s+/u)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .slice(0, 20);

    for (const sentence of sentences) {
        await db
            .prepare(
                `INSERT INTO cortex_claims
             (id, page_id, subject, predicate, value, confidence, status, source_refs_json, created_at, updated_at)
             VALUES ($id, $pageId, $subject, 'states', $value, 0.6, 'active', $sourceRefs, $createdAt, $updatedAt)`
            )
            .run({
                createdAt: now,
                id: createCortexId('ctxcl'),
                pageId,
                sourceRefs: JSON.stringify(sourceRefs),
                subject: input.title,
                updatedAt: now,
                value: sentence,
            });
    }
}

function upsertCapture(
    db: CortexDatabase,
    captureKey: string,
    pageId: string,
    auditId: string,
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<void> {
    return upsertCaptureAsync(db, captureKey, pageId, auditId, sourceRefs, now);
}

async function upsertCaptureAsync(
    db: CortexDatabase,
    captureKey: string,
    pageId: string,
    auditId: string,
    sourceRefs: CortexSourceRef[],
    now: string
): Promise<void> {
    await db
        .prepare(
            `INSERT INTO cortex_captures
         (id, capture_key, status, source_refs_json, output_refs_json, attempts, created_at, updated_at)
         VALUES ($id, $captureKey, 'success', $sourceRefs, $outputRefs, 1, $createdAt, $updatedAt)
         ON CONFLICT(capture_key) DO UPDATE SET
            status = 'success',
            output_refs_json = excluded.output_refs_json,
            attempts = cortex_captures.attempts + 1,
            updated_at = excluded.updated_at`
        )
        .run({
            captureKey,
            createdAt: now,
            id: createCortexId('ctxcap'),
            outputRefs: JSON.stringify([{ auditId, id: pageId, kind: 'page' }]),
            sourceRefs: JSON.stringify(sourceRefs),
            updatedAt: now,
        });
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

async function findCapture(db: CortexDatabase, captureKey: string): Promise<CaptureLookup> {
    const row = await db
        .prepare(
            `SELECT status, output_refs_json
             FROM cortex_captures
             WHERE capture_key = ?
             LIMIT 1`
        )
        .get<{ output_refs_json: string; status: string }>(captureKey);
    if (!row) {
        return null;
    }
    const refs = JSON.parse(row.output_refs_json) as Array<{
        auditId?: string;
        id?: string;
    }>;
    return {
        auditId: refs[0]?.auditId ?? '',
        pageId: refs[0]?.id ?? '',
        status: row.status,
    };
}
