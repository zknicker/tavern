import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    CortexBacklinkList,
    CortexPage,
    CortexPageList,
    CortexSearchInput,
    CortexSearchResult,
    CortexStatus,
    CortexTopicList,
} from '@tavern/api';
import { RUNTIME_ROOT, readConfigValue, resolveConfiguredPath } from '../config';
import { resolveManagedWikiHubPath } from '../hermes/llm-wiki';

interface WikiConfig {
    hubPath: string;
    source: 'environment' | 'runtime';
}

interface MarkdownFile {
    archived: boolean;
    content: string;
    mtime: Date;
    path: string;
    relativePath: string;
    section: CortexPage['section'];
    size: number;
    topic: string;
    wikiPath: string;
}

const searchableSections = new Set<CortexPage['section']>([
    'wiki',
    'raw',
    'todos',
    'datasets',
    'output',
    'inbox',
    'root',
]);

/**
 * Agent-written trust reports live in dot dirs. They stay out of listings and
 * search — the Cortex health surface reads them directly by path — so the
 * page tree remains pure knowledge.
 */
const reportDirectories = new Set(['.audit', '.librarian']);

export async function getCortexStatus(): Promise<CortexStatus> {
    const config = await resolveWikiConfig();
    const topics = await listTopicRecords(config.hubPath);
    const pages = await Promise.all(topics.map((topic) => listMarkdownFilesForTopic(topic)));
    const flattened = pages.flat();

    return {
        archivedTopicCount: topics.filter((topic) => topic.archived).length,
        configSource: config.source,
        hubPath: config.hubPath,
        pageCount: flattened.length,
        readable: await canAccess(config.hubPath, fsConstants.R_OK),
        topicCount: topics.filter((topic) => !topic.archived).length,
        writable: await canAccess(config.hubPath, fsConstants.W_OK),
    };
}

export async function listCortexTopics(options: { includeArchived?: boolean } = {}) {
    const config = await resolveWikiConfig();
    return {
        hubPath: config.hubPath,
        topics: (await listTopicRecords(config.hubPath)).filter(
            (topic) => options.includeArchived || !topic.archived
        ),
    } satisfies CortexTopicList;
}

export async function listCortexPages(
    options: { includeArchived?: boolean; topic?: string | null } = {}
): Promise<CortexPageList> {
    const topics = await listCortexTopics({ includeArchived: options.includeArchived });
    const selectedTopics = options.topic
        ? topics.topics.filter((topic) => topic.slug === options.topic)
        : topics.topics;
    const pages = (
        await Promise.all(selectedTopics.map((topic) => listMarkdownFilesForTopic(topic)))
    )
        .flat()
        .map(toPageSummary)
        .sort((left, right) => left.title.localeCompare(right.title));

    return { pages, topic: options.topic ?? null };
}

export async function getCortexPage(input: {
    path: string;
    topic: string;
}): Promise<CortexPage | null> {
    const file = await readMarkdownFile(input.topic, input.path);
    return file ? toPage(file) : null;
}

export async function searchCortex(input: CortexSearchInput): Promise<CortexSearchResult> {
    const pages = await readSearchablePages(input);
    const query = input.query.toLowerCase();
    const hits = pages
        .map((page) => {
            const titleScore = page.title.toLowerCase().includes(query) ? 5 : 0;
            const tagScore = frontmatterListMatches(page.frontmatter.tags, query) ? 4 : 0;
            const aliasScore = frontmatterListMatches(page.frontmatter.aliases, query) ? 4 : 0;
            const pathScore = page.path.toLowerCase().includes(query) ? 3 : 0;
            const summary = readString(page.frontmatter.summary);
            const summaryIndex = summary ? summary.toLowerCase().indexOf(query) : -1;
            const summaryScore = summaryIndex >= 0 ? 2 : 0;
            const bodyIndex = page.body.toLowerCase().indexOf(query);
            const bodyScore = bodyIndex >= 0 ? 1 : 0;
            const score = titleScore + tagScore + aliasScore + pathScore + summaryScore + bodyScore;
            return score > 0
                ? {
                      page: toPageSummaryFromPage(page),
                      score,
                      snippet: buildSearchSnippet({ bodyIndex, page, summary, summaryIndex }),
                  }
                : null;
        })
        .filter((hit): hit is NonNullable<typeof hit> => Boolean(hit))
        .sort(
            (left, right) =>
                right.score - left.score || left.page.title.localeCompare(right.page.title)
        );

    const offset = input.offset ?? 0;
    const limit = input.limit ?? 20;
    return {
        hits: hits.slice(offset, offset + limit),
        limit,
        offset,
        query: input.query,
        totalHitCount: hits.length,
    };
}

export async function listCortexBacklinks(input: {
    path: string;
    topic: string;
}): Promise<CortexBacklinkList> {
    const target = normalizePageTarget(input.path);
    const pages = await readPages({ includeArchived: true });
    const links = pages.flatMap((page) => {
        if (page.topic === input.topic && normalizePageTarget(page.path) === target) {
            return [];
        }
        const matched = extractLinkTargets(page.body).filter(
            (link) => normalizePageTarget(link.target) === target
        );
        if (matched.length === 0) {
            return [];
        }
        const [link] = matched;
        return [
            {
                fromPath: page.path,
                fromTitle: page.title,
                label: link.label,
                targetPath: input.path,
                targetTopic: input.topic,
                topic: page.topic,
            },
        ];
    });

    return { links, targetPath: input.path, topic: input.topic };
}

export async function resolveWikiConfig(): Promise<WikiConfig> {
    const configured =
        readConfigValue('TAVERN_WIKI_HUB_PATH') ?? readConfigValue('TAVERN_CORTEX_WIKI_PATH');
    if (configured) {
        return { hubPath: resolveConfiguredPath(configured), source: 'environment' };
    }

    return { hubPath: resolveManagedWikiHubPath(RUNTIME_ROOT), source: 'runtime' };
}

async function listTopicRecords(hubPath: string): Promise<CortexTopicList['topics']> {
    const topicsPath = path.join(hubPath, 'topics');
    const active = await readTopicDir(topicsPath, false);
    const archived = await readTopicDir(path.join(topicsPath, '.archive'), true);
    return [...active, ...archived].sort((left, right) => left.slug.localeCompare(right.slug));
}

async function readTopicDir(dir: string, archived: boolean): Promise<CortexTopicList['topics']> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => ({
            archived,
            path: path.join(dir, entry.name),
            slug: archived ? `.archive/${entry.name}` : entry.name,
            title: titleFromSlug(entry.name),
        }));
}

async function listMarkdownFilesForTopic(
    record: CortexTopicList['topics'][number]
): Promise<MarkdownFile[]> {
    const files = await walkMarkdown(record.path);
    const markdownFiles = await Promise.all(files.map((file) => toMarkdownFile(record, file)));
    return markdownFiles.filter((file) => searchableSections.has(file.section));
}

async function readMarkdownFile(topic: string, relativePath: string): Promise<MarkdownFile | null> {
    const topics = await listCortexTopics({ includeArchived: true });
    const records = topics.topics.filter((candidate) => candidate.slug === topic);
    for (const record of records) {
        const file = await readMarkdownFileFromTopic(record, relativePath);
        if (file) {
            return file;
        }
    }
    return null;
}

async function readMarkdownFileFromTopic(
    record: CortexTopicList['topics'][number],
    relativePath: string
): Promise<MarkdownFile | null> {
    const safePath = normalizeRelativeMarkdownPath(relativePath);
    const topicRoot = path.resolve(record.path);
    const absolutePath = path.resolve(topicRoot, safePath);
    if (!isPathInside(absolutePath, topicRoot)) {
        return null;
    }
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
        return null;
    }
    return toMarkdownFile(record, absolutePath);
}

async function walkMarkdown(root: string): Promise<string[]> {
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
    const files: string[] = [];
    for (const entry of entries) {
        if (entry.name.startsWith('.')) {
            continue;
        }
        const entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walkMarkdown(entryPath)));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(entryPath);
        }
    }
    return files;
}

async function toMarkdownFile(
    topic: CortexTopicList['topics'][number],
    absolutePath: string
): Promise<MarkdownFile> {
    const [content, stat] = await Promise.all([
        fs.readFile(absolutePath, 'utf8'),
        fs.stat(absolutePath),
    ]);
    const relativePath = path.relative(topic.path, absolutePath);
    return {
        archived: topic.archived,
        content,
        mtime: stat.mtime,
        path: absolutePath,
        relativePath,
        section: sectionFromPath(relativePath),
        size: stat.size,
        topic: topic.slug,
        wikiPath: topic.path,
    };
}

async function readSearchablePages(input: CortexSearchInput): Promise<CortexPage[]> {
    return readPages(input);
}

async function readPages(input: { includeArchived?: boolean; topic?: string | null }) {
    const list = await listCortexPages({
        includeArchived: input.includeArchived,
        topic: input.topic,
    });
    const pages = await Promise.all(
        list.pages.map((page) => getCortexPage({ path: page.path, topic: page.topic }))
    );
    return pages.filter((page): page is CortexPage => Boolean(page));
}

function toPageSummary(file: MarkdownFile) {
    return toPageSummaryFromPage(toPage(file));
}

function toPageSummaryFromPage(page: CortexPage) {
    return {
        archived: page.archived,
        path: page.path,
        section: page.section,
        title: page.title,
        topic: page.topic,
        updatedAt: page.updatedAt,
    };
}

function toPage(file: MarkdownFile): CortexPage {
    const parsed = parseMarkdown(file.content);
    const title =
        readString(parsed.frontmatter.title) ??
        firstHeading(parsed.body) ??
        titleFromPath(file.relativePath);
    return {
        archived: file.archived,
        body: parsed.body,
        frontmatter: parsed.frontmatter,
        links: extractWikiLinks(parsed.body),
        path: file.relativePath,
        section: file.section,
        size: file.size,
        title,
        topic: file.topic,
        updatedAt: file.mtime.toISOString(),
        wikiPath: file.wikiPath,
    };
}

function parseMarkdown(content: string) {
    if (!content.startsWith('---\n')) {
        return { body: content, frontmatter: {} };
    }
    const close = /\n---[ \t]*(?:\r?\n|$)/u.exec(content.slice(4));
    if (!close) {
        return { body: content, frontmatter: {} };
    }
    return {
        body: content.slice(4 + close.index + close[0].length).trimStart(),
        frontmatter: parseFrontmatter(content.slice(4, 4 + close.index)),
    };
}

function parseFrontmatter(value: string): Record<string, unknown> {
    const frontmatter: Record<string, unknown> = {};
    const lines = value.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
        const match = /^([A-Za-z0-9_-]+):\s*(.*)$/u.exec(lines[index]);
        if (!match) {
            continue;
        }
        const inlineValue = (match[2] ?? '').trim();
        if (inlineValue) {
            frontmatter[match[1]] = parseFrontmatterValue(inlineValue);
            continue;
        }
        const { items, nextIndex } = readBlockListItems(lines, index + 1);
        frontmatter[match[1]] = items ?? '';
        index = nextIndex - 1;
    }
    return frontmatter;
}

function readBlockListItems(lines: string[], startIndex: number) {
    const items: string[] = [];
    let index = startIndex;
    while (index < lines.length) {
        const item = /^\s+-\s+(.*)$/u.exec(lines[index]);
        if (!item) {
            break;
        }
        const trimmed = (item[1] ?? '').trim().replace(/^["']|["']$/gu, '');
        if (trimmed) {
            items.push(trimmed);
        }
        index += 1;
    }
    return { items: items.length > 0 ? items : null, nextIndex: index };
}

function parseFrontmatterValue(value: string): unknown {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed
            .slice(1, -1)
            .split(',')
            .map((item) => item.trim().replace(/^["']|["']$/gu, ''))
            .filter(Boolean);
    }
    return trimmed.replace(/^["']|["']$/gu, '');
}

function extractWikiLinks(content: string): CortexPage['links'] {
    return Array.from(content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/gu)).map(
        (match) => ({
            label: match[2]?.trim() || null,
            target: match[1]?.trim() ?? '',
        })
    );
}

/**
 * Link targets for backlink derivation: `[[wikilinks]]` plus the markdown half
 * of llm-wiki's dual-link convention (relative `.md` links).
 */
function extractLinkTargets(content: string): CortexPage['links'] {
    const markdownLinks = Array.from(
        content.matchAll(/(?<!\])\[([^\]]+)\]\(<?([^)#>\s]+\.md)(?:#[^)>]*)?>?\)/gu)
    )
        .filter((match) => !/^[a-z][a-z0-9+.-]*:/iu.test(match[2] ?? ''))
        .map((match) => ({
            label: match[1]?.trim() || null,
            target: match[2]?.trim() ?? '',
        }));
    return [...extractWikiLinks(content), ...markdownLinks];
}

function sectionFromPath(relativePath: string): CortexPage['section'] {
    const [first] = relativePath.split(path.sep);
    if (first && reportDirectories.has(first)) {
        return 'reports';
    }
    if (
        first === 'raw' ||
        first === 'wiki' ||
        first === 'todos' ||
        first === 'datasets' ||
        first === 'output' ||
        first === 'inbox'
    ) {
        return first;
    }
    return 'root';
}

function normalizeRelativeMarkdownPath(value: string) {
    const normalized = path.normalize(value.trim());
    return normalized.endsWith('.md') ? normalized : `${normalized}.md`;
}

function isPathInside(filePath: string, root: string) {
    return filePath === root || filePath.startsWith(`${root}${path.sep}`);
}

function normalizePageTarget(value: string) {
    return (
        value
            .toLowerCase()
            .replace(/\.md$/u, '')
            .split('/')
            .at(-1)
            ?.replace(/[^a-z0-9]+/gu, '-')
            .replace(/^-|-$/gu, '') ?? ''
    );
}

function firstHeading(body: string) {
    return body
        .split('\n')
        .find((line) => line.startsWith('# '))
        ?.replace(/^#\s+/u, '')
        .trim();
}

function titleFromPath(relativePath: string) {
    return titleFromSlug(path.basename(relativePath, '.md'));
}

function titleFromSlug(slug: string) {
    return slug.replace(/[-_]+/gu, ' ').replace(/\b\w/gu, (character) => character.toUpperCase());
}

function snippet(content: string, index: number) {
    const start = Math.max(0, index - 80);
    const end = Math.min(content.length, index + 180);
    return content.slice(start, end).replace(/\s+/gu, ' ').trim();
}

function frontmatterListMatches(value: unknown, query: string) {
    const entries = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    return entries.some(
        (entry) => typeof entry === 'string' && entry.toLowerCase().includes(query)
    );
}

function buildSearchSnippet(input: {
    bodyIndex: number;
    page: CortexPage;
    summary: string | null;
    summaryIndex: number;
}) {
    if (input.bodyIndex >= 0) {
        return snippet(input.page.body, input.bodyIndex);
    }
    if (input.summary && input.summaryIndex >= 0) {
        return snippet(input.summary, input.summaryIndex);
    }
    return '';
}

async function canAccess(targetPath: string, mode: number) {
    try {
        await fs.access(targetPath, mode);
        return true;
    } catch {
        return false;
    }
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
