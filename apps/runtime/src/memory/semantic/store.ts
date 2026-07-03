import crypto from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    AgentRuntimeSaveSemanticMemorySettings,
    AgentRuntimeSemanticMemorySettings,
    SemanticMemoryBacklinkList,
    SemanticMemoryCreatePage,
    SemanticMemoryMovePath,
    SemanticMemoryPage,
    SemanticMemoryPageList,
    SemanticMemoryPathInput,
    SemanticMemoryPathMutationResult,
    SemanticMemorySavePage,
    SemanticMemorySearchInput,
    SemanticMemorySearchResult,
    SemanticMemoryStatus,
} from '@tavern/api';
import { RUNTIME_ROOT, readConfigValue, resolveConfiguredPath } from '../../config.ts';
import { getDb } from '../../db/connection.ts';
import { namedParams } from '../../db/sqlite.ts';
import { getStoredAgent } from '../../tavern/agents-store.ts';
import { getSemanticMemoryWatcherFreshness, restartSemanticMemoryWatcher } from './watcher.ts';

const semanticMemorySettingsMetadataKey = 'semanticMemory:settings';
const defaultSemanticMemoryPath = path.join(RUNTIME_ROOT, 'memory');
const rootMemoryDirectories = [
    'companies',
    'concepts',
    'people',
    'projects',
    'routines',
    'sites',
] as const;
const sharedMemoryTaxonomySeed = `# Memory Taxonomy

Last updated: 2026-07-03T00:00:00Z

## Invariants

- Shared Semantic Memory lives under \`memory/\`.
- Semantic Memory is the shared wiki-style knowledge system exposed in Tavern's Memory page.
- Per-agent briefing files (\`USER.md\`, \`MEMORY.md\`) live in each agent workspace, not in shared Semantic Memory.
- Episodic memory is worker-owned evidence under the agent's hidden workspace memory, not in shared Semantic Memory.
- Each agent owns its own episodic memory and dreaming pass.
- Semantic pages use frontmatter plus \`## Current\` and \`## History\`.
- Read-time retrieval must not depend on this file.
- Each semantic write must have one primary home.
- Episodic references should prefer deterministic read-only identifiers or paths.
- Semantic references should prefer backing Markdown file paths.
- Secrets, credentials, raw transcripts, and temporary task progress do not belong in durable memory.

## Agent Workspace Files

### \`MEMORY.md\`

What goes here:

- durable operating rules for that agent
- workflow conventions that matter on many tasks
- agent-specific defaults that should be loaded at session start

What does not go here:

- detailed world knowledge
- facts that belong in shared Semantic Memory
- one-off task context

### \`USER.md\`

What goes here:

- stable user profile for that agent
- stable user preferences for that agent
- long-running user context worth loading every session

What does not go here:

- shared project, company, site, or concept knowledge
- transient session chatter
- detailed dossiers that belong in Semantic Memory or episodic evidence

## Directory Rules

### \`people/\`

What goes here:

- durable facts and history about specific humans
- relationship context that is not simply a preference for one agent

What does not go here:

- agent-local user briefing facts that belong in that agent's \`USER.md\`
- company-level knowledge
- browser interaction procedures

### \`companies/\`

What goes here:

- organization knowledge
- durable company context, history, products, and relationships

What does not go here:

- person-specific profiles
- site-specific UI procedures unless they materially affect company knowledge

### \`sites/\`

What goes here:

- browser and product knowledge for a site as one durable page or small folder
- UI behavior, workflow procedures, and durable site quirks
- durable mappings between a site and the user's real-world purpose for using it

What does not go here:

- general user preference that is not site-related
- broad company knowledge unless it materially affects site use

### \`projects/\`

What goes here:

- active or durable workstreams
- project goals, decisions, links, constraints, and long-running context
- implementation history that future work on the same project should know

What does not go here:

- one-off session chatter
- generalized lessons that should move to \`concepts/\`
- company, person, or site facts whose primary owner is elsewhere

### \`concepts/\`

What goes here:

- reusable frameworks and mental models
- generalized lessons that apply across projects, products, or sites
- durable domain knowledge without a clearer entity owner

What does not go here:

- project-specific implementation detail
- entity-specific facts that belong to people, companies, sites, or projects

### \`routines/<routine-slug>/MEMORY.md\`

What goes here:

- recurring routine execution memory
- durable notes and results useful for future runs of the same routine
- routine-specific failures, cadence lessons, and expected outputs

What does not go here:

- general agent operating rules
- broad project facts that should live under \`projects/\`
- raw logs

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

If the category is not yet stable, keep the observation in the owning agent's hidden episodic memory until it is ready to promote.

## Write Routing Decision Tree

1. Is the information durable enough to remember beyond the current session?
   - If no: keep it out of durable memory.
2. Is the information secret, credential material, unsafe, or private beyond the user's intent?
   - If yes: do not write it.
3. Is the item sparse, event-like, uncertain, or better preserved as an observation first?
   - If yes: append it to the owning agent's hidden episodic memory.
4. Did the item also change stable understanding about a shared subject?
   - If yes: update the primary Semantic Memory page as well.
5. Is the item agent-local behavior or a stable user preference for one agent?
   - If yes: update that agent's \`MEMORY.md\` or \`USER.md\`, not shared Semantic Memory.
6. Is there already a semantic page whose subject is the correct primary home?
   - If yes: update that page instead of creating a new one.
7. Before creating a new semantic page, have slug, title, and aliases been checked?
   - If no: check for duplicates first.
8. What is the correct semantic write shape?
   - Append \`## History\` first, ideally with source paths or job identifiers.
   - Rewrite \`## Current\` only if stable understanding changed.
9. Does the item fit no existing directory cleanly?
   - Route it to the closest durable home, then create a resolver improvement task.

## Promotion

- Promote to an agent's \`USER.md\` only when the change is stable, high-value, and broadly useful for that agent at session start.
- Promote to an agent's \`MEMORY.md\` only when the change affects that agent's default behavior across many tasks.
- Promote from episodic into Semantic Memory when repeated observations or strong evidence establish durable shared understanding.
- Do not promote one-off incidents, narrow quirks, or uncertain facts into agent briefing files.
- Do not force every episodic observation into Semantic Memory.

## Page Shape

Semantic pages should use this shape unless a page has a stronger local format:

\`\`\`markdown
---
title: Page Title
aliases: []
tags: []
updated: YYYY-MM-DD
---

# Page Title

## Current

- Stable facts and current understanding.

## History

- YYYY-MM-DD: Evidence, change, or observation with a source path or job id when available.

## Links

- Related Semantic Memory pages or useful external references.
\`\`\`

Use \`## Links\` only when it adds real navigation value.

## Resolver Evolution

- Clarify wording when the same ambiguity appears repeatedly.
- Add a new directory only when many durable items lack a clean primary home.
- Preserve existing invariants over inventing new top-level structure casually.
- Update decision rules and directory rules together.
`;
const rootMemoryFiles = {
    'TAXONOMY.md': sharedMemoryTaxonomySeed,
} as const;

interface SemanticMemoryConfig {
    configuredPath: string | null;
    environmentPath: string | null;
    memoryPath: string;
    source: SemanticMemoryStatus['configSource'];
    updatedAt: string | null;
}

interface MarkdownFile {
    content: string;
    memoryPath: string;
    mtime: Date;
    path: string;
    relativePath: string;
    size: number;
}

export interface SemanticMemoryFileSnapshot {
    content: string;
    hash: string;
    path: string;
}

export interface SemanticMemoryFileChange {
    afterHash: string;
    beforeHash: string | null;
    path: string;
}

export interface EpisodicMemoryFile {
    content: string;
    path: string;
    updatedAt: string;
}

export async function getSemanticMemoryStatus(): Promise<SemanticMemoryStatus> {
    const config = await resolveSemanticMemoryConfig();
    const files = await walkMarkdown(config.memoryPath);

    return {
        configSource: config.source,
        freshness: getSemanticMemoryWatcherFreshness(),
        indexExists: await isMarkdownFile(path.join(config.memoryPath, 'TAXONOMY.md')),
        pageCount: files.length,
        readable: await canAccess(config.memoryPath, fsConstants.R_OK),
        memoryPath: config.memoryPath,
        writable: await canAccess(config.memoryPath, fsConstants.W_OK),
    };
}

export async function getSemanticMemorySettings(): Promise<AgentRuntimeSemanticMemorySettings> {
    const config = await resolveSemanticMemoryConfig();
    return {
        configSource: config.source,
        configuredPath: config.configuredPath,
        effectivePath: config.memoryPath,
        environmentPath: config.environmentPath,
        updatedAt: config.updatedAt,
    };
}

export async function saveSemanticMemorySettings(
    input: AgentRuntimeSaveSemanticMemorySettings
): Promise<AgentRuntimeSemanticMemorySettings> {
    const memoryPath = input.memoryPath.trim();
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
                key: semanticMemorySettingsMetadataKey,
                now,
                value: JSON.stringify({ memoryPath }),
            })
        );

    await prepareSemanticMemoryRoot(resolveConfiguredPath(memoryPath));
    await restartSemanticMemoryWatcher({ emitRootChanged: true });
    return await getSemanticMemorySettings();
}

export async function prepareSemanticMemoryRoot(memoryPath: string) {
    await fs.mkdir(memoryPath, { recursive: true });
    await Promise.all(
        rootMemoryDirectories.map((directory) =>
            fs.mkdir(path.join(memoryPath, directory), { recursive: true })
        )
    );
    await Promise.all(
        Object.entries(rootMemoryFiles).map(([fileName, content]) =>
            writeIfMissing(path.join(memoryPath, fileName), content)
        )
    );
}

export async function listSemanticMemoryPages(): Promise<SemanticMemoryPageList> {
    const config = await resolveSemanticMemoryConfig();
    const pages = (await listMarkdownFiles(config.memoryPath))
        .map(toPageSummary)
        .sort((left, right) => left.title.localeCompare(right.title));
    const folders = (await listSemanticMemoryFolders(config.memoryPath)).sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    );

    return { folders, pages };
}

export async function getSemanticMemoryPage(input: {
    path: string;
}): Promise<SemanticMemoryPage | null> {
    const config = await resolveSemanticMemoryConfig();
    const file = await readMarkdownFile(config.memoryPath, input.path);
    return file ? toPage(file) : null;
}

export async function createSemanticMemoryPage(
    input: SemanticMemoryCreatePage
): Promise<SemanticMemoryPathMutationResult> {
    const config = await resolveSemanticMemoryConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveSemanticMemoryChildPath(config.memoryPath, relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.body ?? defaultMarkdownBody(relativePath), {
        flag: 'wx',
    });
    clearSemanticMemoryTombstone(relativePath);

    const file = await toMarkdownFile(config.memoryPath, absolutePath);
    return { kind: 'page', page: toPage(file), path: relativePath };
}

export async function saveSemanticMemoryPage(
    input: SemanticMemorySavePage
): Promise<SemanticMemoryPathMutationResult> {
    const config = await resolveSemanticMemoryConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveSemanticMemoryChildPath(config.memoryPath, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
        throw new Error('Memory file does not exist.');
    }

    const current = await fs.readFile(absolutePath, 'utf8');
    await fs.writeFile(absolutePath, replaceMarkdownBody(current, input.body));

    const file = await toMarkdownFile(config.memoryPath, absolutePath);
    return { kind: 'page', page: toPage(file), path: relativePath };
}

export async function createSemanticMemoryFolder(
    input: SemanticMemoryPathInput
): Promise<SemanticMemoryPathMutationResult> {
    const config = await resolveSemanticMemoryConfig();
    const relativePath = normalizeWritableFolderPath(input.path);
    const absolutePath = resolveSemanticMemoryChildPath(config.memoryPath, relativePath);

    await fs.mkdir(absolutePath, { recursive: false });
    return { kind: 'folder', page: null, path: relativePath };
}

export async function deleteSemanticMemoryPage(
    input: SemanticMemoryPathInput
): Promise<SemanticMemoryPathMutationResult> {
    const config = await resolveSemanticMemoryConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveSemanticMemoryChildPath(config.memoryPath, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
        throw new Error('Memory file does not exist.');
    }

    await fs.rm(absolutePath);
    writeSemanticMemoryTombstone(relativePath, {
        actor: 'user',
        deletedAt: new Date().toISOString(),
        reason: 'manual_delete',
    });
    return { kind: 'page', page: null, path: relativePath };
}

export async function readSemanticMemoryFile(input: {
    path: string;
}): Promise<SemanticMemoryFileSnapshot | null> {
    const config = await resolveSemanticMemoryConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveSemanticMemoryChildPath(config.memoryPath, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
        return null;
    }
    const content = await fs.readFile(absolutePath, 'utf8');
    return {
        content,
        hash: sha256(content),
        path: relativePath,
    };
}

export async function writeSemanticMemoryFile(input: {
    content: string;
    expectedHash: string | null;
    path: string;
}): Promise<SemanticMemoryFileChange> {
    const config = await resolveSemanticMemoryConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    if (isSemanticMemoryTombstoned(relativePath)) {
        throw new Error('Memory file was deleted by the user and cannot be recreated by dreaming.');
    }
    const absolutePath = resolveSemanticMemoryChildPath(config.memoryPath, relativePath);
    const previous = await fs.readFile(absolutePath, 'utf8').catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    const beforeHash = previous === null ? null : sha256(previous);
    if (beforeHash !== input.expectedHash) {
        throw new Error('Memory file changed since it was read.');
    }

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.content);
    clearSemanticMemoryTombstone(relativePath);
    return {
        afterHash: sha256(input.content),
        beforeHash,
        path: relativePath,
    };
}

export async function listAgentEpisodicMemoryFiles(input: {
    agentId: string;
    since?: Date | null;
}): Promise<EpisodicMemoryFile[]> {
    const agent = getStoredAgent(input.agentId);
    if (!agent) {
        throw new Error(`Agent "${input.agentId}" does not exist.`);
    }
    const episodicRoot = path.join(agent.workspaceFolder, '.memory', 'episodic');
    const entries = await fs.readdir(episodicRoot, { withFileTypes: true }).catch((error) => {
        if (isNotFoundError(error)) {
            return [];
        }
        throw error;
    });
    const files: EpisodicMemoryFile[] = [];
    for (const entry of entries) {
        if (!(entry.isFile() && entry.name.endsWith('.md'))) {
            continue;
        }
        const filePath = path.join(episodicRoot, entry.name);
        const stat = await fs.stat(filePath);
        if (input.since && stat.mtime <= input.since) {
            continue;
        }
        files.push({
            content: await fs.readFile(filePath, 'utf8'),
            path: path.join('.memory', 'episodic', entry.name),
            updatedAt: stat.mtime.toISOString(),
        });
    }
    return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function deleteSemanticMemoryFolder(
    input: SemanticMemoryPathInput
): Promise<SemanticMemoryPathMutationResult> {
    const config = await resolveSemanticMemoryConfig();
    const relativePath = normalizeWritableFolderPath(input.path);
    const absolutePath = resolveSemanticMemoryChildPath(config.memoryPath, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isDirectory()) {
        throw new Error('Memory folder does not exist.');
    }

    const files = await walkMarkdown(absolutePath);
    const now = new Date().toISOString();
    for (const file of files) {
        const tombstonePath = path.posix.join(
            relativePath,
            path.relative(absolutePath, file).split(path.sep).join(path.posix.sep)
        );
        writeSemanticMemoryTombstone(tombstonePath, {
            actor: 'user',
            deletedAt: now,
            reason: 'manual_folder_delete',
        });
    }
    await fs.rm(absolutePath, { recursive: true });
    return { kind: 'folder', page: null, path: relativePath };
}

export async function moveSemanticMemoryPath(
    input: SemanticMemoryMovePath
): Promise<SemanticMemoryPathMutationResult> {
    const config = await resolveSemanticMemoryConfig();
    const fromPath =
        input.kind === 'page'
            ? normalizeWritableMarkdownPath(input.fromPath)
            : normalizeWritableFolderPath(input.fromPath);
    const toPath =
        input.kind === 'page'
            ? normalizeWritableMarkdownPath(input.toPath)
            : normalizeWritableFolderPath(input.toPath);
    const fromAbsolutePath = resolveSemanticMemoryChildPath(config.memoryPath, fromPath);
    const toAbsolutePath = resolveSemanticMemoryChildPath(config.memoryPath, toPath);
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
        const file = await toMarkdownFile(config.memoryPath, toAbsolutePath);
        return { kind: 'page', page: toPage(file), path: toPath };
    }

    return { kind: 'folder', page: null, path: toPath };
}

export async function searchSemanticMemory(
    input: SemanticMemorySearchInput
): Promise<SemanticMemorySearchResult> {
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

export async function listSemanticMemoryBacklinks(input: {
    path: string;
}): Promise<SemanticMemoryBacklinkList> {
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

export async function resolveSemanticMemoryConfig(): Promise<SemanticMemoryConfig> {
    return resolveSemanticMemoryConfigSync();
}

export function resolveSemanticMemoryConfigSync(): SemanticMemoryConfig {
    const environmentPath = readConfigValue('TAVERN_MEMORY_PATH');
    if (environmentPath) {
        return {
            configuredPath: null,
            environmentPath,
            source: 'environment',
            updatedAt: null,
            memoryPath: resolveConfiguredPath(environmentPath),
        };
    }

    const settings = readStoredSemanticMemorySettings();
    if (settings) {
        return {
            configuredPath: settings.memoryPath,
            environmentPath: null,
            source: 'settings',
            updatedAt: settings.updatedAt,
            memoryPath: resolveConfiguredPath(settings.memoryPath),
        };
    }

    return {
        configuredPath: null,
        environmentPath: null,
        source: 'default',
        updatedAt: null,
        memoryPath: resolveConfiguredPath(defaultSemanticMemoryPath),
    };
}

function readStoredSemanticMemorySettings(): { updatedAt: string; memoryPath: string } | null {
    let row: { updated_at: string; value: string } | undefined;
    try {
        row = getDb()
            .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
            .get(namedParams({ key: semanticMemorySettingsMetadataKey })) as
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

    const parsed = JSON.parse(row.value) as { memoryPath?: unknown };
    if (typeof parsed.memoryPath !== 'string' || parsed.memoryPath.trim().length === 0) {
        throw new Error('Stored Memory settings are invalid; re-save them.');
    }

    return { updatedAt: row.updated_at, memoryPath: parsed.memoryPath.trim() };
}

async function listMarkdownFiles(memoryPath: string): Promise<MarkdownFile[]> {
    const files = await walkMarkdown(memoryPath);
    return await Promise.all(files.map((file) => toMarkdownFile(memoryPath, file)));
}

async function listSemanticMemoryFolders(memoryPath: string) {
    const folders = await walkFolders(memoryPath);
    return folders.map((folder) => path.relative(memoryPath, folder));
}

async function readMarkdownFile(memoryPath: string, relativePath: string) {
    const safePath = normalizeRelativeMarkdownPath(relativePath);
    const root = path.resolve(memoryPath);
    const absolutePath = path.resolve(root, safePath);
    if (!isPathInside(absolutePath, root)) {
        return null;
    }
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
        return null;
    }
    return toMarkdownFile(memoryPath, absolutePath);
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

async function toMarkdownFile(memoryPath: string, absolutePath: string): Promise<MarkdownFile> {
    const [content, stat] = await Promise.all([
        fs.readFile(absolutePath, 'utf8'),
        fs.stat(absolutePath),
    ]);
    return {
        content,
        mtime: stat.mtime,
        path: absolutePath,
        relativePath: path.relative(memoryPath, absolutePath),
        size: stat.size,
        memoryPath,
    };
}

async function readPages() {
    const list = await listSemanticMemoryPages();
    const pages = await Promise.all(
        list.pages.map((page) => getSemanticMemoryPage({ path: page.path }))
    );
    return pages.filter((page): page is SemanticMemoryPage => Boolean(page));
}

function toPageSummary(file: MarkdownFile) {
    return toPageSummaryFromPage(toPage(file));
}

function toPageSummaryFromPage(page: SemanticMemoryPage) {
    return {
        path: page.path,
        title: page.title,
        updatedAt: page.updatedAt,
    };
}

function toPage(file: MarkdownFile): SemanticMemoryPage {
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
        memoryPath: file.memoryPath,
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

function extractMemoryLinks(content: string): SemanticMemoryPage['links'] {
    return Array.from(content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/gu)).map(
        (match) => ({
            label: match[2]?.trim() || null,
            target: match[1]?.trim() ?? '',
        })
    );
}

function extractLinkTargets(content: string): SemanticMemoryPage['links'] {
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

function resolveSemanticMemoryChildPath(memoryPath: string, relativePath: string) {
    const root = path.resolve(memoryPath);
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

function writeSemanticMemoryTombstone(
    relativePath: string,
    input: { actor: string; deletedAt: string; reason: string | null }
) {
    getDb()
        .prepare(
            `INSERT INTO memory_page_tombstones (path, deleted_at, actor, reason)
             VALUES ($path, $deletedAt, $actor, $reason)
             ON CONFLICT(path) DO UPDATE SET
               deleted_at = excluded.deleted_at,
               actor = excluded.actor,
               reason = excluded.reason`
        )
        .run(
            namedParams({
                actor: input.actor,
                deletedAt: input.deletedAt,
                path: relativePath,
                reason: input.reason,
            })
        );
}

function clearSemanticMemoryTombstone(relativePath: string) {
    getDb()
        .prepare('DELETE FROM memory_page_tombstones WHERE path = $path')
        .run(namedParams({ path: relativePath }));
}

function isSemanticMemoryTombstoned(relativePath: string) {
    return Boolean(
        getDb()
            .prepare('SELECT 1 FROM memory_page_tombstones WHERE path = $path LIMIT 1')
            .get(namedParams({ path: relativePath }))
    );
}

function sha256(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function isNotFoundError(error: unknown) {
    return Boolean(
        error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code?: unknown }).code === 'ENOENT'
    );
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
    page: SemanticMemoryPage;
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
