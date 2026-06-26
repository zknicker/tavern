import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    AgentRuntimeSaveVaultSettings,
    AgentRuntimeVaultSettings,
    VaultBacklinkList,
    VaultCreatePage,
    VaultMovePath,
    VaultPage,
    VaultPageList,
    VaultPathInput,
    VaultPathMutationResult,
    VaultSavePage,
    VaultSearchInput,
    VaultSearchResult,
    VaultStatus,
} from '@tavern/api';
import { RUNTIME_ROOT, readConfigValue, resolveConfiguredPath } from '../config.ts';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { getVaultWatcherFreshness, restartVaultWatcher } from './watcher.ts';

const vaultSettingsMetadataKey = 'vault:settings';
const defaultVaultPath = path.join(RUNTIME_ROOT, 'memory');
const rootMemoryDirectories = ['episodic', 'projects', 'routines'] as const;
const rootMemoryFiles = {
    'MEMORY.md': '# Memory Briefing\n\n',
    'TAXONOMY.md': `# Memory Taxonomy

Last updated: 2026-06-25T00:00:00Z

## Invariants

- Unified memory lives under \`memory/\`.
- Semantic and episodic memory are the source of truth. L1 files (\`MEMORY.md\`, \`USER.md\`) are derived from them.
- L1 files must stay small enough for prompt loading.
- Semantic pages use frontmatter plus \`## Current\` and \`## History\`.
- Episodic memory lives under \`episodic/\` and uses append-only raw Markdown entries grouped by date.
- Read-time retrieval must not depend on this file.
- Each semantic write must have one primary home.
- Episodic references should prefer deterministic read-only getters over search expressions or side-effectful code.
- Semantic and L1 references should prefer backing Markdown file paths.

## L1 Root Files

\`MEMORY.md\`

What goes here:

- globally reusable operating rules
- durable default behavior
- tool and workflow conventions that matter on many tasks

What does not go here:

- detailed world knowledge
- detailed service, project, or relationship context
- one-off task context

\`USER.md\`

What goes here:

- stable user profile
- stable user preferences
- high-level service, project, or relationship mappings
- long-running user context worth loading every session

What does not go here:

- detailed workflows for specific services or projects
- ephemeral session notes
- dossier-style detail that belongs in semantic or episodic memory

## Bootstrapped Directories

\`episodic/\`

Use for append-only observations from recent conversation or execution evidence.

\`projects/\`

Use for durable project context, goals, decisions, links, and active workstreams.

\`routines/<routine-slug>/MEMORY.md\`

Use for recurring workflow memory owned by that routine.

## Adding Semantic Folders

Do not pre-create broad category folders for every possible subject. Add a new semantic folder only when a stable category needs a durable home and does not fit an existing folder.

Good semantic folders:

- use a concrete noun the user would recognize
- have more than one likely page or repeated future use
- do not overlap an existing folder's ownership
- can be explained with a short "what goes here" rule

Before first use:

- add the folder to this taxonomy
- define what goes there and what does not
- prefer the narrowest durable folder over a catch-all

If the category is not yet stable, keep the observation in \`episodic/\` until it is ready to promote.

## Episodic Memory

\`episodic/YYYY-MM-DD.md\`

Use for append-only observations from recent conversation or execution evidence.

Write here when the observation is durable enough to preserve but not stable, repeated, or broad enough to promote.

Each entry should include a timestamp, concrete prose, and a source reference when one exists.

## Write Routing

1. If the fact is secret, credential material, or unsafe to store, do not write it.
2. If it is temporary task progress or a transcript dump, do not write it.
3. If it is sparse, event-shaped, uncertain, or raw evidence, append to \`episodic/YYYY-MM-DD.md\`.
4. If it fits an existing semantic folder, write to the one semantic page that owns that subject.
5. If it needs a new durable category, update this taxonomy before creating the folder.
6. Before creating a semantic page, check existing paths, titles, and aliases.
7. For semantic writes, add a \`## History\` evidence entry first. Update \`## Current\` only when stable understanding changed.
8. Refresh \`MEMORY.md\` or \`USER.md\` only when the update should be loaded at session start.
9. If routing friction repeats, update this taxonomy with a short resolver note.

## Promotion

- Promote repeated, strong, or broadly useful episodic observations into semantic memory.
- Promote only stable, high-value defaults into L1 root files.
- Do not force every episodic observation into semantic memory.
`,
    'USER.md': '# User Briefing\n\n',
} as const;

interface VaultConfig {
    configuredPath: string | null;
    environmentPath: string | null;
    source: VaultStatus['configSource'];
    updatedAt: string | null;
    vaultPath: string;
}

interface MarkdownFile {
    content: string;
    mtime: Date;
    path: string;
    relativePath: string;
    size: number;
    vaultPath: string;
}

export async function getVaultStatus(): Promise<VaultStatus> {
    const config = await resolveVaultConfig();
    const files = await walkMarkdown(config.vaultPath);

    return {
        configSource: config.source,
        freshness: getVaultWatcherFreshness(),
        indexExists: await isMarkdownFile(path.join(config.vaultPath, 'TAXONOMY.md')),
        pageCount: files.length,
        readable: await canAccess(config.vaultPath, fsConstants.R_OK),
        vaultPath: config.vaultPath,
        writable: await canAccess(config.vaultPath, fsConstants.W_OK),
    };
}

export async function getVaultSettings(): Promise<AgentRuntimeVaultSettings> {
    const config = await resolveVaultConfig();
    return {
        configSource: config.source,
        configuredPath: config.configuredPath,
        effectivePath: config.vaultPath,
        environmentPath: config.environmentPath,
        updatedAt: config.updatedAt,
    };
}

export async function saveVaultSettings(
    input: AgentRuntimeSaveVaultSettings
): Promise<AgentRuntimeVaultSettings> {
    const vaultPath = input.vaultPath.trim();
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, $value, $now)
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                key: vaultSettingsMetadataKey,
                now,
                value: JSON.stringify({ vaultPath }),
            })
        );

    await prepareVaultRoot(resolveConfiguredPath(vaultPath));
    await restartVaultWatcher({ emitRootChanged: true });
    return await getVaultSettings();
}

export async function prepareVaultRoot(vaultPath: string) {
    await fs.mkdir(vaultPath, { recursive: true });
    await Promise.all(
        rootMemoryDirectories.map((directory) =>
            fs.mkdir(path.join(vaultPath, directory), { recursive: true })
        )
    );
    await Promise.all(
        Object.entries(rootMemoryFiles).map(([fileName, content]) =>
            writeIfMissing(path.join(vaultPath, fileName), content)
        )
    );
}

export async function listVaultPages(): Promise<VaultPageList> {
    const config = await resolveVaultConfig();
    const pages = (await listMarkdownFiles(config.vaultPath))
        .map(toPageSummary)
        .sort((left, right) => left.title.localeCompare(right.title));
    const folders = (await listVaultFolders(config.vaultPath)).sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    );

    return { folders, pages };
}

export async function getVaultPage(input: { path: string }): Promise<VaultPage | null> {
    const config = await resolveVaultConfig();
    const file = await readMarkdownFile(config.vaultPath, input.path);
    return file ? toPage(file) : null;
}

export async function createVaultPage(input: VaultCreatePage): Promise<VaultPathMutationResult> {
    const config = await resolveVaultConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveVaultChildPath(config.vaultPath, relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.body ?? defaultMarkdownBody(relativePath), {
        flag: 'wx',
    });

    const file = await toMarkdownFile(config.vaultPath, absolutePath);
    return { kind: 'page', page: toPage(file), path: relativePath };
}

export async function saveVaultPage(input: VaultSavePage): Promise<VaultPathMutationResult> {
    const config = await resolveVaultConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveVaultChildPath(config.vaultPath, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
        throw new Error('Memory file does not exist.');
    }

    const current = await fs.readFile(absolutePath, 'utf8');
    await fs.writeFile(absolutePath, replaceMarkdownBody(current, input.body));

    const file = await toMarkdownFile(config.vaultPath, absolutePath);
    return { kind: 'page', page: toPage(file), path: relativePath };
}

export async function createVaultFolder(input: VaultPathInput): Promise<VaultPathMutationResult> {
    const config = await resolveVaultConfig();
    const relativePath = normalizeWritableFolderPath(input.path);
    const absolutePath = resolveVaultChildPath(config.vaultPath, relativePath);

    await fs.mkdir(absolutePath, { recursive: false });
    return { kind: 'folder', page: null, path: relativePath };
}

export async function deleteVaultPage(input: VaultPathInput): Promise<VaultPathMutationResult> {
    const config = await resolveVaultConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveVaultChildPath(config.vaultPath, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
        throw new Error('Memory file does not exist.');
    }

    await fs.rm(absolutePath);
    return { kind: 'page', page: null, path: relativePath };
}

export async function deleteVaultFolder(input: VaultPathInput): Promise<VaultPathMutationResult> {
    const config = await resolveVaultConfig();
    const relativePath = normalizeWritableFolderPath(input.path);
    const absolutePath = resolveVaultChildPath(config.vaultPath, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isDirectory()) {
        throw new Error('Memory folder does not exist.');
    }

    await fs.rm(absolutePath, { recursive: true });
    return { kind: 'folder', page: null, path: relativePath };
}

export async function moveVaultPath(input: VaultMovePath): Promise<VaultPathMutationResult> {
    const config = await resolveVaultConfig();
    const fromPath =
        input.kind === 'page'
            ? normalizeWritableMarkdownPath(input.fromPath)
            : normalizeWritableFolderPath(input.fromPath);
    const toPath =
        input.kind === 'page'
            ? normalizeWritableMarkdownPath(input.toPath)
            : normalizeWritableFolderPath(input.toPath);
    const fromAbsolutePath = resolveVaultChildPath(config.vaultPath, fromPath);
    const toAbsolutePath = resolveVaultChildPath(config.vaultPath, toPath);
    const sourceStat = await fs.stat(fromAbsolutePath).catch(() => null);
    const targetStat = await fs.stat(toAbsolutePath).catch(() => null);

    if (input.kind === 'page' && !(sourceStat?.isFile() && fromAbsolutePath.endsWith('.md'))) {
        throw new Error('Memory file does not exist.');
    }
    if (input.kind === 'folder' && !sourceStat?.isDirectory()) {
        throw new Error('Memory folder does not exist.');
    }
    if (targetStat) {
        throw new Error('A Memory item already exists at that path.');
    }
    if (
        input.kind === 'folder' &&
        (toAbsolutePath === fromAbsolutePath ||
            toAbsolutePath.startsWith(`${fromAbsolutePath}${path.sep}`))
    ) {
        throw new Error('Memory folder cannot be moved into itself.');
    }

    await fs.mkdir(path.dirname(toAbsolutePath), { recursive: true });
    await fs.rename(fromAbsolutePath, toAbsolutePath);

    if (input.kind === 'page') {
        const file = await toMarkdownFile(config.vaultPath, toAbsolutePath);
        return { kind: 'page', page: toPage(file), path: toPath };
    }

    return { kind: 'folder', page: null, path: toPath };
}

export async function searchVault(input: VaultSearchInput): Promise<VaultSearchResult> {
    const pages = await readPages();
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

export async function listVaultBacklinks(input: { path: string }): Promise<VaultBacklinkList> {
    const target = normalizePageTarget(input.path);
    const pages = await readPages();
    const targetPage = pages.find((page) => page.path === input.path);
    const targetSlugs = new Set(
        [target, targetPage ? normalizePageTarget(targetPage.title) : null].filter(
            (slug): slug is string => Boolean(slug)
        )
    );
    const links = pages.flatMap((page) => {
        if (normalizePageTarget(page.path) === target) {
            return [];
        }
        const matched = extractLinkTargets(page.body).filter((link) =>
            targetSlugs.has(normalizePageTarget(link.target))
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
            },
        ];
    });

    return { links, targetPath: input.path };
}

export async function resolveVaultConfig(): Promise<VaultConfig> {
    return resolveVaultConfigSync();
}

export function resolveVaultConfigSync(): VaultConfig {
    const environmentPath = readConfigValue('TAVERN_VAULT_PATH');
    if (environmentPath) {
        return {
            configuredPath: null,
            environmentPath,
            source: 'environment',
            updatedAt: null,
            vaultPath: resolveConfiguredPath(environmentPath),
        };
    }

    const settings = readStoredVaultSettings();
    if (settings) {
        return {
            configuredPath: settings.vaultPath,
            environmentPath: null,
            source: 'settings',
            updatedAt: settings.updatedAt,
            vaultPath: resolveConfiguredPath(settings.vaultPath),
        };
    }

    return {
        configuredPath: null,
        environmentPath: null,
        source: 'default',
        updatedAt: null,
        vaultPath: resolveConfiguredPath(defaultVaultPath),
    };
}

function readStoredVaultSettings(): { updatedAt: string; vaultPath: string } | null {
    let row: { updated_at: string; value: string } | undefined;
    try {
        row = getDb()
            .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
            .get(namedParams({ key: vaultSettingsMetadataKey })) as
            | { updated_at: string; value: string }
            | undefined;
    } catch (error) {
        if (error instanceof Error && error.message.includes('Database not initialized')) {
            return null;
        }
        throw error;
    }

    if (!row) {
        return null;
    }

    const parsed = JSON.parse(row.value) as { vaultPath?: unknown };
    if (typeof parsed.vaultPath !== 'string' || parsed.vaultPath.trim().length === 0) {
        throw new Error('Stored Memory settings are invalid; re-save them.');
    }

    return { updatedAt: row.updated_at, vaultPath: parsed.vaultPath.trim() };
}

async function listMarkdownFiles(vaultPath: string): Promise<MarkdownFile[]> {
    const files = await walkMarkdown(vaultPath);
    return await Promise.all(files.map((file) => toMarkdownFile(vaultPath, file)));
}

async function listVaultFolders(vaultPath: string) {
    const folders = await walkFolders(vaultPath);
    return folders.map((folder) => path.relative(vaultPath, folder));
}

async function readMarkdownFile(vaultPath: string, relativePath: string) {
    const safePath = normalizeRelativeMarkdownPath(relativePath);
    const root = path.resolve(vaultPath);
    const absolutePath = path.resolve(root, safePath);
    if (!isPathInside(absolutePath, root)) {
        return null;
    }
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
        return null;
    }
    return toMarkdownFile(vaultPath, absolutePath);
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

async function walkFolders(root: string): Promise<string[]> {
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
    const folders: string[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
            continue;
        }
        const entryPath = path.join(root, entry.name);
        folders.push(entryPath, ...(await walkFolders(entryPath)));
    }
    return folders;
}

async function toMarkdownFile(vaultPath: string, absolutePath: string): Promise<MarkdownFile> {
    const [content, stat] = await Promise.all([
        fs.readFile(absolutePath, 'utf8'),
        fs.stat(absolutePath),
    ]);
    return {
        content,
        mtime: stat.mtime,
        path: absolutePath,
        relativePath: path.relative(vaultPath, absolutePath),
        size: stat.size,
        vaultPath,
    };
}

async function readPages() {
    const list = await listVaultPages();
    const pages = await Promise.all(list.pages.map((page) => getVaultPage({ path: page.path })));
    return pages.filter((page): page is VaultPage => Boolean(page));
}

function toPageSummary(file: MarkdownFile) {
    return toPageSummaryFromPage(toPage(file));
}

function toPageSummaryFromPage(page: VaultPage) {
    return {
        path: page.path,
        title: page.title,
        updatedAt: page.updatedAt,
    };
}

function toPage(file: MarkdownFile): VaultPage {
    const parsed = parseMarkdown(file.content);
    const title =
        readString(parsed.frontmatter.title) ??
        firstHeading(parsed.body) ??
        titleFromPath(file.relativePath);
    return {
        body: parsed.body,
        frontmatter: parsed.frontmatter,
        links: extractMemoryLinks(parsed.body),
        path: file.relativePath,
        size: file.size,
        title,
        updatedAt: file.mtime.toISOString(),
        vaultPath: file.vaultPath,
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

function extractMemoryLinks(content: string): VaultPage['links'] {
    return Array.from(content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/gu)).map(
        (match) => ({
            label: match[2]?.trim() || null,
            target: match[1]?.trim() ?? '',
        })
    );
}

function extractLinkTargets(content: string): VaultPage['links'] {
    const markdownLinks = Array.from(
        content.matchAll(/(?<!\])\[([^\]]+)\]\(<?([^)#>\s]+\.md)(?:#[^)>]*)?>?\)/gu)
    )
        .filter((match) => !/^[a-z][a-z0-9+.-]*:/iu.test(match[2] ?? ''))
        .map((match) => ({
            label: match[1]?.trim() || null,
            target: match[2]?.trim() ?? '',
        }));
    return [...extractMemoryLinks(content), ...markdownLinks];
}

function normalizeRelativeMarkdownPath(value: string) {
    const normalized = path.normalize(value.trim());
    return normalized.endsWith('.md') ? normalized : `${normalized}.md`;
}

function normalizeWritableMarkdownPath(value: string) {
    const normalized = normalizeWritableRelativePath(value);
    return normalized.endsWith('.md') ? normalized : `${normalized}.md`;
}

function normalizeWritableFolderPath(value: string) {
    const normalized = normalizeWritableRelativePath(value);
    if (normalized.endsWith('.md')) {
        throw new Error('Memory folder paths must not end in .md.');
    }
    return normalized;
}

function normalizeWritableRelativePath(value: string) {
    const trimmed = value.trim().replaceAll('\\', '/');
    const segments = trimmed.split('/');
    if (
        !trimmed ||
        trimmed.startsWith('/') ||
        segments.some(
            (segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.')
        )
    ) {
        throw new Error('Memory path must stay inside Memory and avoid dot directories.');
    }

    const normalized = path.posix.normalize(trimmed);
    if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
        throw new Error('Memory path must stay inside Memory.');
    }

    return normalized;
}

function resolveVaultChildPath(vaultPath: string, relativePath: string) {
    const root = path.resolve(vaultPath);
    const absolutePath = path.resolve(root, ...relativePath.split('/'));
    if (!isPathInside(absolutePath, root)) {
        throw new Error('Memory path must stay inside Memory.');
    }
    return absolutePath;
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

function defaultMarkdownBody(relativePath: string) {
    return `# ${titleFromPath(relativePath)}\n`;
}

function replaceMarkdownBody(content: string, body: string) {
    const prefix = readFrontmatterPrefix(content);
    return prefix ? `${prefix}${body.trimStart()}` : body;
}

function readFrontmatterPrefix(content: string) {
    if (!content.startsWith('---\n')) {
        return null;
    }
    const close = /\n---[ \t]*(?:\r?\n|$)/u.exec(content.slice(4));
    if (!close) {
        return null;
    }
    return content.slice(0, 4 + close.index + close[0].length);
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
    page: VaultPage;
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

async function isMarkdownFile(filePath: string) {
    const stat = await fs.stat(filePath).catch(() => null);
    return Boolean(stat?.isFile());
}

async function writeIfMissing(filePath: string, content: string) {
    await fs.writeFile(filePath, content, { flag: 'wx' }).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
        }
    });
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
