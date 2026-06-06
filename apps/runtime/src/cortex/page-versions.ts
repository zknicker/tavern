import type { CortexPageVersion, CortexPageVersionList, CortexSourceRef } from '@tavern/api';
import type { CortexDatabase } from './db';
import { createCortexId } from './ids';
import type { PageRow } from './rows';
import { normalizePageLookup, nowIso, readJsonArray, readJsonRecord } from './rows';

interface PageVersionRow {
    body: string;
    compiled_truth: string;
    content_hash: string;
    created_at: string;
    frontmatter_json: string;
    id: string;
    page_id: string;
    page_updated_at: string;
    slug: string;
    source_refs_json: string;
    status: CortexPageVersion['status'];
    title: string;
    type: string;
    version_number: number;
}

export async function recordCortexPageVersion(
    db: CortexDatabase,
    page: PageRow,
    createdAt = nowIso()
): Promise<void> {
    const existing = await db
        .prepare(
            `SELECT id
             FROM cortex_page_versions
             WHERE page_id = $pageId
               AND content_hash = $contentHash
             LIMIT 1`
        )
        .get<{ id: string }>({
            contentHash: page.content_hash,
            pageId: page.id,
        });
    if (existing) {
        return;
    }

    const latest = await db
        .prepare(
            `SELECT COALESCE(MAX(version_number), 0) AS version_number
             FROM cortex_page_versions
             WHERE page_id = ?`
        )
        .get<{ version_number: number }>(page.id);
    await db
        .prepare(
            `INSERT INTO cortex_page_versions
             (id, page_id, version_number, slug, title, type, status, compiled_truth, body,
              frontmatter_json, source_refs_json, content_hash, page_updated_at, created_at)
             VALUES ($id, $pageId, $versionNumber, $slug, $title, $type, $status,
              $compiledTruth, $body, $frontmatter, $sourceRefs, $contentHash,
              $pageUpdatedAt, $createdAt)`
        )
        .run({
            body: page.body,
            compiledTruth: page.compiled_truth,
            contentHash: page.content_hash,
            createdAt,
            frontmatter: page.frontmatter_json,
            id: createCortexId('ctxv'),
            pageId: page.id,
            pageUpdatedAt: page.updated_at,
            slug: page.slug,
            sourceRefs: page.source_refs_json,
            status: page.status,
            title: page.title,
            type: page.type,
            versionNumber: (latest?.version_number ?? 0) + 1,
        });
}

export async function listCortexPageVersions(
    db: CortexDatabase,
    slugOrId: string
): Promise<CortexPageVersionList> {
    const page = await findVersionedPage(db, slugOrId);
    if (!page) {
        throw new Error(`Cortex page not found: ${slugOrId}.`);
    }
    const rows = await db
        .prepare(
            `SELECT *
             FROM cortex_page_versions
             WHERE page_id = ?
             ORDER BY version_number DESC`
        )
        .all<PageVersionRow>(page.id);
    return {
        slug: page.slug,
        versions: rows.map(toVersionSummary),
    };
}

export async function getCortexPageVersion(
    db: CortexDatabase,
    slugOrId: string,
    versionId: string
): Promise<CortexPageVersion> {
    const page = await findVersionedPage(db, slugOrId);
    if (!page) {
        throw new Error(`Cortex page not found: ${slugOrId}.`);
    }
    const versionNumber = /^\d+$/u.test(versionId) ? Number(versionId) : null;
    const row = await db
        .prepare(
            `SELECT *
             FROM cortex_page_versions
             WHERE page_id = $pageId
               AND (id = $versionId OR version_number = $versionNumber)
             LIMIT 1`
        )
        .get<PageVersionRow>({
            pageId: page.id,
            versionId,
            versionNumber,
        });
    if (!row) {
        throw new Error(`Cortex page version not found: ${versionId}.`);
    }
    return toVersion(row);
}

async function findVersionedPage(db: CortexDatabase, slugOrId: string) {
    const normalized = normalizePageLookup(slugOrId);
    return await db
        .prepare('SELECT id, slug FROM cortex_pages WHERE slug = ? OR id = ? LIMIT 1')
        .get<{ id: string; slug: string }>(normalized, slugOrId);
}

function toVersionSummary(row: PageVersionRow): CortexPageVersionList['versions'][number] {
    return {
        contentHash: row.content_hash,
        createdAt: row.created_at,
        id: row.id,
        pageId: row.page_id,
        pageUpdatedAt: row.page_updated_at,
        slug: row.slug,
        status: row.status,
        title: row.title,
        type: row.type,
        versionNumber: row.version_number,
    };
}

function toVersion(row: PageVersionRow): CortexPageVersion {
    return {
        ...toVersionSummary(row),
        body: row.body,
        compiledTruth: row.compiled_truth,
        frontmatter: readJsonRecord(row.frontmatter_json),
        sourceRefs: readJsonArray<CortexSourceRef>(row.source_refs_json),
    };
}
