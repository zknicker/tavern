import fs from 'node:fs';
import path from 'node:path';
import type { CortexSourceRef } from '@tavern/api';
import type { CortexDatabase } from './db';
import { refreshDerivedPageState } from './derive';
import { createCortexId, hashText, slugifyCortexTitle } from './ids';
import { recordCortexPageVersion } from './page-versions';
import { resolveCortexWikiPath } from './read';
import { nowIso, type PageRow, readStringArray } from './rows';

export interface CortexSyncResult {
    pagesSynced: number;
}

export async function syncCortexMarkdown(
    db: CortexDatabase,
    rootPath = resolveCortexWikiPath()
): Promise<CortexSyncResult> {
    if (!fs.existsSync(rootPath)) {
        return { pagesSynced: 0 };
    }
    const now = nowIso();
    let pagesSynced = 0;
    for (const filePath of listMarkdownFiles(rootPath)) {
        const parsed = parseCortexMarkdownFile(rootPath, filePath);
        await upsertMarkdownPage(db, parsed, now);
        pagesSynced += 1;
    }
    return { pagesSynced };
}

interface ParsedMarkdownPage {
    aliases: string[];
    body: string;
    compiledTruth: string;
    contentHash: string;
    frontmatter: Record<string, unknown>;
    slug: string;
    sourceRef: CortexSourceRef;
    sourceRefs: CortexSourceRef[];
    status: 'active' | 'archived' | 'deleted' | 'stale';
    timeline: TimelineDraft[];
    title: string;
    type: string;
}

interface TimelineDraft {
    body: string;
    createdAt: string;
    sourceRefs: CortexSourceRef[];
}

async function upsertMarkdownPage(
    db: CortexDatabase,
    page: ParsedMarkdownPage,
    now: string
): Promise<void> {
    const sourceRefs = page.sourceRefs.length > 0 ? page.sourceRefs : [page.sourceRef];
    const registeredSourceRefs = uniqueSourceRefs([page.sourceRef, ...sourceRefs]);
    for (const sourceRef of registeredSourceRefs) {
        await upsertSource(db, sourceRef, now);
    }
    const frontmatterId =
        typeof page.frontmatter.id === 'string' && page.frontmatter.id.trim()
            ? page.frontmatter.id.trim()
            : null;
    const existingBySlug = await db
        .prepare('SELECT id, created_at FROM cortex_pages WHERE slug = ? LIMIT 1')
        .get<{ created_at: string; id: string }>(page.slug);
    const existingById = frontmatterId
        ? await db
              .prepare('SELECT id, slug, created_at FROM cortex_pages WHERE id = ? LIMIT 1')
              .get<{ created_at: string; id: string; slug: string }>(frontmatterId)
        : null;
    if (!(existingBySlug || !existingById || existingById.slug === page.slug)) {
        await db
            .prepare('UPDATE cortex_pages SET slug = ?, updated_at = ? WHERE id = ?')
            .run(page.slug, now, existingById.id);
    }
    const existing = existingBySlug ?? existingById;
    const id = frontmatterId ?? existing?.id ?? createCortexId('ctxp');
    const uniqueRefs = uniqueSourceRefs(sourceRefs);

    await db
        .prepare(
            `INSERT INTO cortex_pages
         (id, slug, title, type, status, compiled_truth, body, frontmatter_json,
          source_refs_json, content_hash, created_at, updated_at)
         VALUES ($id, $slug, $title, $type, $status, $compiledTruth, $body,
          $frontmatter, $sourceRefs, $contentHash, $createdAt, $updatedAt)
         ON CONFLICT(slug) DO UPDATE SET
           title = excluded.title,
           type = excluded.type,
           status = excluded.status,
           compiled_truth = excluded.compiled_truth,
           body = excluded.body,
           frontmatter_json = excluded.frontmatter_json,
           source_refs_json = excluded.source_refs_json,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at,
           deleted_at = NULL`
        )
        .run({
            body: page.body,
            compiledTruth: page.compiledTruth,
            contentHash: page.contentHash,
            createdAt: existing?.created_at ?? now,
            frontmatter: JSON.stringify(page.frontmatter),
            id,
            slug: page.slug,
            sourceRefs: JSON.stringify(uniqueRefs),
            status: page.status,
            title: page.title,
            type: page.type,
            updatedAt: now,
        });

    const row = await db
        .prepare('SELECT * FROM cortex_pages WHERE slug = ? LIMIT 1')
        .get<PageRow>(page.slug);
    if (row) {
        await replaceAliases(db, row.id, page.aliases, page.slug, now);
        await replaceTimeline(db, row.id, page.timeline);
        await refreshDerivedPageState(db, row, now);
        await recordCortexPageVersion(db, row, now);
    }
}

async function upsertSource(
    db: CortexDatabase,
    sourceRef: CortexSourceRef,
    now: string
): Promise<void> {
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

function parseCortexMarkdownFile(rootPath: string, filePath: string): ParsedMarkdownPage {
    const text = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(rootPath, filePath);
    const fallbackSlug = slugifyCortexTitle(relativePath.replace(/\.md$/u, ''));
    const { bodyText, frontmatter } = splitFrontmatter(text);
    const title = readTitle(bodyText) ?? String(frontmatter.title ?? fallbackSlug);
    const slug =
        typeof frontmatter.slug === 'string' ? slugifyCortexTitle(frontmatter.slug) : fallbackSlug;
    const sourceRefs = parseSourceRefs(frontmatter.source_refs);
    const timeline = parseTimeline(readSection(bodyText, 'Timeline') ?? '', sourceRefs);
    return {
        aliases: readStringArray(frontmatter.aliases),
        body: readSection(bodyText, 'Body') ?? bodyText.trim(),
        compiledTruth: readSection(bodyText, 'Compiled Truth') ?? '',
        contentHash: hashText(text),
        frontmatter,
        slug,
        sourceRefs,
        sourceRef: {
            id: `ctxs_${hashText(filePath).slice(0, 24)}`,
            kind: 'file',
            locator: filePath,
        },
        status: readPageStatus(frontmatter.status),
        timeline,
        title,
        type: typeof frontmatter.type === 'string' && frontmatter.type ? frontmatter.type : 'note',
    };
}

function replaceAliases(
    db: CortexDatabase,
    pageId: string,
    aliases: string[],
    pageSlug: string,
    now: string
): Promise<void> {
    return replaceAliasesAsync(db, pageId, aliases, pageSlug, now);
}

async function replaceAliasesAsync(
    db: CortexDatabase,
    pageId: string,
    aliases: string[],
    pageSlug: string,
    now: string
): Promise<void> {
    await db.prepare('DELETE FROM cortex_page_aliases WHERE page_id = ?').run(pageId);
    for (const alias of uniqueAliases(aliases, pageSlug)) {
        await db
            .prepare(
                `INSERT INTO cortex_page_aliases
             (id, page_id, alias, created_at)
             VALUES ($id, $pageId, $alias, $createdAt)`
            )
            .run({
                alias,
                createdAt: now,
                id: createCortexId('ctxa'),
                pageId,
            });
    }
}

function uniqueAliases(aliases: string[], pageSlug: string): string[] {
    const seen = new Set<string>();
    for (const alias of aliases) {
        const normalized = slugifyCortexTitle(alias);
        if (normalized && normalized !== pageSlug) {
            seen.add(normalized);
        }
    }
    return [...seen];
}

function readPageStatus(value: unknown): 'active' | 'archived' | 'deleted' | 'stale' {
    return value === 'archived' || value === 'deleted' || value === 'stale' ? value : 'active';
}

function replaceTimeline(
    db: CortexDatabase,
    pageId: string,
    timeline: TimelineDraft[]
): Promise<void> {
    return replaceTimelineAsync(db, pageId, timeline);
}

async function replaceTimelineAsync(
    db: CortexDatabase,
    pageId: string,
    timeline: TimelineDraft[]
): Promise<void> {
    await db.prepare('DELETE FROM cortex_timeline_entries WHERE page_id = ?').run(pageId);
    for (const [index, entry] of timeline.entries()) {
        await db
            .prepare(
                `INSERT INTO cortex_timeline_entries
             (id, page_id, body, source_refs_json, created_at)
             VALUES ($id, $pageId, $body, $sourceRefs, $createdAt)`
            )
            .run({
                body: entry.body,
                createdAt: entry.createdAt,
                id: `ctxt_${hashText(`${pageId}:${entry.createdAt}:${index}:${entry.body}`).slice(0, 24)}`,
                pageId,
                sourceRefs: JSON.stringify(entry.sourceRefs),
            });
    }
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

function parseSourceRefs(value: unknown): CortexSourceRef[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((entry) => {
        if (!(entry && typeof entry === 'object')) {
            return [];
        }
        const record = entry as Record<string, unknown>;
        if (typeof record.id !== 'string' || typeof record.kind !== 'string') {
            return [];
        }
        return [
            {
                id: record.id,
                kind: record.kind,
                locator: typeof record.locator === 'string' ? record.locator : null,
            },
        ];
    });
}

function parseTimeline(text: string, sourceRefs: CortexSourceRef[]): TimelineDraft[] {
    const entries: TimelineDraft[] = [];
    const matches = Array.from(
        text.matchAll(/^###\s+(.+?)\s*\n([\s\S]*?)(?=^###\s+|(?![\s\S]))/gmu)
    );
    for (const match of matches) {
        const createdAt = match[1]?.trim();
        const parsed = parseTimelineBody(match[2]?.trim() ?? '', sourceRefs);
        const body = parsed.body;
        if (createdAt && body) {
            entries.push({ body, createdAt, sourceRefs: parsed.sourceRefs });
        }
    }
    return entries;
}

function parseTimelineBody(
    text: string,
    fallbackSourceRefs: CortexSourceRef[]
): { body: string; sourceRefs: CortexSourceRef[] } {
    const match = /^<!--\s*source_refs:\s*([\s\S]*?)\s*-->\s*/u.exec(text);
    if (!match) {
        return { body: text, sourceRefs: fallbackSourceRefs };
    }
    return {
        body: text.slice(match[0].length).trim(),
        sourceRefs: parseTimelineSourceRefs(match[1]) ?? fallbackSourceRefs,
    };
}

function parseTimelineSourceRefs(value: string | undefined): CortexSourceRef[] | null {
    if (!value) {
        return null;
    }
    try {
        return parseSourceRefs(JSON.parse(value));
    } catch {
        return null;
    }
}

function listMarkdownFiles(rootPath: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
        const fullPath = path.join(rootPath, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '.raw') {
                continue;
            }
            files.push(...listMarkdownFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }
    return files.sort();
}

function splitFrontmatter(text: string): {
    bodyText: string;
    frontmatter: Record<string, unknown>;
} {
    const match = /^---\n([\s\S]*?)\n---\n?/u.exec(text);
    if (!match) {
        return { bodyText: text, frontmatter: {} };
    }
    return {
        bodyText: text.slice(match[0].length),
        frontmatter: parseSimpleFrontmatter(match[1]),
    };
}

function parseSimpleFrontmatter(text: string): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    for (const line of text.split('\n')) {
        const index = line.indexOf(':');
        if (index <= 0) {
            continue;
        }
        const key = line.slice(0, index).trim();
        const raw = line.slice(index + 1).trim();
        record[key] = parseFrontmatterValue(raw);
    }
    return record;
}

function parseFrontmatterValue(raw: string): unknown {
    if (!raw) {
        return '';
    }
    if (raw.startsWith('[') || raw.startsWith('{') || raw === 'true' || raw === 'false') {
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    }
    return raw.replace(/^"(.*)"$/u, '$1');
}

function readTitle(text: string): string | null {
    const match = /^#\s+(.+)$/mu.exec(text);
    return match?.[1]?.trim() ?? null;
}

function readSection(text: string, heading: string): string | null {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const match = new RegExp(
        `^## ${escaped}\\s*\\n([\\s\\S]*?)(?=^## |^---\\s*$|(?![\\s\\S]))`,
        'imu'
    ).exec(text);
    return match?.[1]?.trim() ?? null;
}
