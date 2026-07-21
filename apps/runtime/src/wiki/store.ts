import crypto from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    AgentRuntimeSaveWikiSettings,
    AgentRuntimeWikiSettings,
    WikiAttachment,
    WikiAttachmentContent,
    WikiBacklinkList,
    WikiCreatePage,
    WikiMovePath,
    WikiPage,
    WikiPageList,
    WikiPathInput,
    WikiPathMutationResult,
    WikiSavePage,
    WikiSearchInput,
    WikiSearchResult,
    WikiStatus,
    WikiUploadAttachment,
} from '@tavern/api';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { RUNTIME_ROOT, readConfigValue, resolveConfiguredPath } from '../config.ts';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';
import { commitWikiHistory, wasWikiPathDeletedRecently } from './history.ts';
import { withWikiPathWriteLock } from './path-write-lock.ts';
import { getWikiWatcherFreshness, restartWikiWatcher } from './watcher.ts';

const wikiSettingsMetadataKey = 'wiki:settings';
const defaultWikiPath = path.join(RUNTIME_ROOT, 'wiki');
const rootWikiDirectories = [
    'companies',
    'concepts',
    'people',
    'projects',
    'routines',
    'sites',
] as const;
const sharedWikiTaxonomySeed = `# Wiki Taxonomy

Last updated: 2026-07-03T00:00:00Z

## Invariants

- Wiki lives under \`wiki/\`.
- Wiki is the shared Markdown knowledge system exposed in Grotto's Wiki page.
- Per-agent core memory files (\`USER.md\`, \`MEMORY.md\`) live in each agent workspace, not in Wiki.
- Episodic memory is worker-owned evidence under the agent's hidden workspace memory, not in Wiki.
- Each agent owns its own episodic memory and dreaming pass.
- Wiki pages use frontmatter plus \`## Current\` and \`## History\`.
- Read-time retrieval must not depend on this file.
- Each Wiki write must have one primary home.
- Episodic references should prefer deterministic read-only identifiers or paths.
- Wiki references should prefer backing Markdown file paths.
- Secrets, credentials, raw transcripts, and temporary task progress do not belong in durable memory.

## Agent Workspace Files

### \`MEMORY.md\`

What goes here:

- durable operating rules for that agent
- workflow conventions that matter on many tasks
- agent-specific defaults that should be loaded at session start

What does not go here:

- detailed world knowledge
- facts that belong in Wiki
- one-off task context

### \`USER.md\`

What goes here:

- stable user profile for that agent
- stable user preferences for that agent
- long-running user context worth loading every session

What does not go here:

- Wiki project, company, site, or concept knowledge
- transient session chatter
- detailed dossiers that belong in Wiki or episodic evidence

## Directory Rules

### \`people/\`

What goes here:

- durable facts and history about specific humans
- relationship context that is not simply a preference for one agent

What does not go here:

- agent-local user facts that belong in that agent's \`USER.md\`
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

### \`routines/<routine-slug>.md\`

What goes here:

- recurring routine execution memory
- durable notes and results useful for future runs of the same routine
- routine-specific failures, cadence lessons, and expected outputs

What does not go here:

- general agent operating rules
- broad project facts that should live under \`projects/\`
- raw logs

## Adding Subject Folders

Do not pre-create broad category folders for every possible subject. Add a new Wiki folder only when a stable category needs a durable home and does not fit an existing folder.

Good Wiki folders:

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
   - If yes: update the primary Wiki page as well.
5. Is the item agent-local behavior or a stable user preference for one agent?
   - If yes: update that agent's \`MEMORY.md\` or \`USER.md\`, not Wiki.
6. Is there already a Wiki page whose subject is the correct primary home?
   - If yes: update that page instead of creating a new one.
7. Before creating a new Wiki page, have slug, title, and aliases been checked?
   - If no: check for duplicates first.
8. What is the correct Wiki write shape?
   - Append \`## History\` first, ideally with source paths or job identifiers.
   - Rewrite \`## Current\` only if stable understanding changed.
9. Does the item fit no existing directory cleanly?
   - Route it to the closest durable home, then create a resolver improvement task.

## Promotion

- Promote to an agent's \`USER.md\` only when the change is stable, high-value, and broadly useful for that agent at session start.
- Promote to an agent's \`MEMORY.md\` only when the change affects that agent's default behavior across many tasks.
- Promote from episodic into Wiki when repeated observations or strong evidence establish durable shared understanding.
- Do not promote one-off incidents, narrow quirks, or uncertain facts into agent core memory files.
- Do not force every episodic observation into Wiki.

## Page Shape

Wiki pages should use this shape unless a page has a stronger local format:

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

- Related Wiki pages or useful external references.
\`\`\`

Use \`## Links\` only when it adds real navigation value.

## Resolver Evolution

- Clarify wording when the same ambiguity appears repeatedly.
- Add a new directory only when many durable items lack a clean primary home.
- Preserve existing invariants over inventing new top-level structure casually.
- Update decision rules and directory rules together.
`;
const rootWikiFiles = {
    'TAXONOMY.md': sharedWikiTaxonomySeed,
} as const;
const maxWikiAttachmentBytes = 8 * 1024 * 1024;
const wikiAttachmentExtensionByMediaType = {
    'image/gif': '.gif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
} as const;

export class WikiPageConflictError extends Error {
    constructor() {
        super('Wiki page changed since it was opened. Reload it before saving again.');
        this.name = 'WikiPageConflictError';
    }
}

interface WikiConfig {
    configuredPath: string | null;
    environmentPath: string | null;
    source: WikiStatus['configSource'];
    updatedAt: string | null;
    wikiPath: string;
}

interface MarkdownFile {
    content: string;
    mtime: Date;
    path: string;
    relativePath: string;
    size: number;
    wikiPath: string;
}

export interface WikiFileSnapshot {
    content: string;
    hash: string;
    path: string;
}

export interface WikiFileChange {
    afterHash: string;
    beforeHash: string | null;
    path: string;
}

export interface EpisodicMemoryFile {
    content: string;
    path: string;
    updatedAt: string;
}

export async function getWikiStatus(): Promise<WikiStatus> {
    const config = await resolveWikiConfig();
    const files = await walkMarkdown(config.wikiPath);

    return {
        configSource: config.source,
        freshness: getWikiWatcherFreshness(),
        indexExists: await isMarkdownFile(path.join(config.wikiPath, 'TAXONOMY.md')),
        pageCount: files.length,
        readable: await canAccess(config.wikiPath, fsConstants.R_OK),
        wikiPath: config.wikiPath,
        writable: await canAccess(config.wikiPath, fsConstants.W_OK),
    };
}

export async function getWikiSettings(): Promise<AgentRuntimeWikiSettings> {
    const config = await resolveWikiConfig();
    return {
        configSource: config.source,
        configuredPath: config.configuredPath,
        effectivePath: config.wikiPath,
        environmentPath: config.environmentPath,
        updatedAt: config.updatedAt,
    };
}

export async function saveWikiSettings(
    input: AgentRuntimeSaveWikiSettings
): Promise<AgentRuntimeWikiSettings> {
    const wikiPath = input.wikiPath.trim();
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
                key: wikiSettingsMetadataKey,
                now,
                value: JSON.stringify({ wikiPath }),
            })
        );

    await prepareWikiRoot(resolveConfiguredPath(wikiPath));
    await restartWikiWatcher({ emitRootChanged: true });
    return await getWikiSettings();
}

export async function prepareWikiRoot(wikiPath: string) {
    await fs.mkdir(wikiPath, { recursive: true });
    await Promise.all(
        rootWikiDirectories.map((directory) =>
            fs.mkdir(path.join(wikiPath, directory), { recursive: true })
        )
    );
    await Promise.all(
        Object.entries(rootWikiFiles).map(([fileName, content]) =>
            writeIfMissing(path.join(wikiPath, fileName), content)
        )
    );
    await commitWikiHistory(wikiPath, { reason: 'prepare' });
}

export async function listWikiPages(): Promise<WikiPageList> {
    const config = await resolveWikiConfig();
    const pages = (await listMarkdownFiles(config.wikiPath))
        .map(toPageSummary)
        .sort((left, right) => left.title.localeCompare(right.title));
    const folders = (await listWikiFolders(config.wikiPath)).sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    );

    return { folders, pages };
}

export async function getWikiPage(input: { path: string }): Promise<WikiPage | null> {
    const config = await resolveWikiConfig();
    const file = await readMarkdownFile(config.wikiPath, input.path);
    return file ? toPage(file) : null;
}

export async function createWikiPage(input: WikiCreatePage): Promise<WikiPathMutationResult> {
    const config = await resolveWikiConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveWikiChildPath(config.wikiPath, relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const body = input.body ?? defaultMarkdownBody(relativePath);
    await fs.writeFile(absolutePath, serializeMarkdownDocument(body, input.frontmatter), {
        flag: 'wx',
    });
    await commitWikiHistory(config.wikiPath, { reason: 'create page' });

    const file = await toMarkdownFile(config.wikiPath, absolutePath);
    return { kind: 'page', page: toPage(file), path: relativePath };
}

export async function saveWikiPage(input: WikiSavePage): Promise<WikiPathMutationResult> {
    const config = await resolveWikiConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveWikiChildPath(config.wikiPath, relativePath);
    return withWikiPathWriteLock(config.wikiPath, async () => {
        const stat = await fs.stat(absolutePath).catch(() => null);
        if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
            throw new Error('Wiki page does not exist.');
        }

        const current = await fs.readFile(absolutePath, 'utf8');
        if (sha256(current) !== input.expectedHash) {
            throw new WikiPageConflictError();
        }
        await fs.writeFile(absolutePath, replaceMarkdownBody(current, input.body));
        await commitWikiHistory(config.wikiPath, { reason: 'save page' });

        const file = await toMarkdownFile(config.wikiPath, absolutePath);
        return { kind: 'page' as const, page: toPage(file), path: relativePath };
    });
}

export async function uploadWikiAttachment(input: WikiUploadAttachment): Promise<WikiAttachment> {
    const config = await resolveWikiConfig();
    return withWikiPathWriteLock(config.wikiPath, () =>
        uploadWikiAttachmentUnlocked(config.wikiPath, input)
    );
}

async function uploadWikiAttachmentUnlocked(
    wikiPath: string,
    input: WikiUploadAttachment
): Promise<WikiAttachment> {
    const pagePath = normalizeWritableMarkdownPath(input.pagePath);
    const pageAbsolutePath = resolveWikiChildPath(wikiPath, pagePath);
    const safePagePath = await resolveExistingWikiChildPath(wikiPath, pageAbsolutePath);
    const pageStat = safePagePath ? await fs.stat(safePagePath).catch(() => null) : null;
    if (!pageStat?.isFile()) {
        throw new Error('Wiki page does not exist.');
    }

    const content = Buffer.from(input.contentBase64, 'base64');
    if (content.byteLength === 0 || content.byteLength > maxWikiAttachmentBytes) {
        throw new Error('Wiki images must be between 1 byte and 8 MiB.');
    }
    if (content.toString('base64') !== normalizeBase64(input.contentBase64)) {
        throw new Error('Wiki image content is not valid base64.');
    }

    const pageDirectory = path.posix.dirname(pagePath);
    const attachmentDirectory =
        pageDirectory === '.' ? '_attachments' : `${pageDirectory}/_attachments`;
    const stem = attachmentStem(input.filename);
    const extension = wikiAttachmentExtensionByMediaType[input.mediaType];
    const filename = `${stem}-${sha256Buffer(content).slice(0, 12)}${extension}`;
    const attachmentPath = `${attachmentDirectory}/${filename}`;
    const absolutePath = resolveWikiChildPath(wikiPath, attachmentPath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const safeAttachmentPath = await resolveWritableWikiChildPath(wikiPath, absolutePath);
    await fs.writeFile(safeAttachmentPath, content, { flag: 'wx' }).catch(async (error) => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
        }
        const existingPath = await resolveExistingWikiChildPath(wikiPath, safeAttachmentPath);
        if (!(existingPath && (await fs.readFile(existingPath)).equals(content))) {
            throw new Error('A different Wiki attachment already exists at the upload path.');
        }
    });
    await commitWikiHistory(wikiPath, { reason: 'add attachment' });

    return {
        markdownPath: `./_attachments/${filename}`,
        mediaType: input.mediaType,
        path: attachmentPath,
        sizeBytes: content.byteLength,
    };
}

export async function getWikiAttachment(input: {
    path: string;
}): Promise<WikiAttachmentContent | null> {
    const config = await resolveWikiConfig();
    const attachmentPath = normalizeWikiAttachmentPath(input.path);
    const absolutePath = resolveWikiChildPath(config.wikiPath, attachmentPath);
    const safeAttachmentPath = await resolveExistingWikiChildPath(config.wikiPath, absolutePath);
    if (!safeAttachmentPath) {
        return null;
    }
    const stat = await fs.stat(safeAttachmentPath).catch(() => null);
    if (!stat?.isFile()) {
        return null;
    }
    if (stat.size > maxWikiAttachmentBytes) {
        throw new Error('Wiki image exceeds the 8 MiB read limit.');
    }
    const mediaType = wikiAttachmentMediaTypeForPath(attachmentPath);
    if (!mediaType) {
        return null;
    }
    const content = await fs.readFile(safeAttachmentPath);
    if (content.byteLength > maxWikiAttachmentBytes) {
        throw new Error('Wiki image exceeds the 8 MiB read limit.');
    }
    return {
        contentBase64: content.toString('base64'),
        mediaType,
        path: attachmentPath,
    };
}

export async function createWikiFolder(input: WikiPathInput): Promise<WikiPathMutationResult> {
    const config = await resolveWikiConfig();
    const relativePath = normalizeWritableFolderPath(input.path);
    const absolutePath = resolveWikiChildPath(config.wikiPath, relativePath);

    await fs.mkdir(absolutePath, { recursive: false });
    await commitWikiHistory(config.wikiPath, { reason: 'create folder' });
    return { kind: 'folder', page: null, path: relativePath };
}

export async function deleteWikiPage(input: WikiPathInput): Promise<WikiPathMutationResult> {
    const config = await resolveWikiConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveWikiChildPath(config.wikiPath, relativePath);
    return withWikiPathWriteLock(config.wikiPath, async () => {
        const stat = await fs.stat(absolutePath).catch(() => null);
        if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
            throw new Error('Wiki page does not exist.');
        }

        await commitWikiHistory(config.wikiPath, { reason: 'baseline' });
        await fs.rm(absolutePath);
        await commitWikiHistory(config.wikiPath, { reason: 'delete page' });
        return { kind: 'page' as const, page: null, path: relativePath };
    });
}

export async function readWikiFile(input: { path: string }): Promise<WikiFileSnapshot | null> {
    const config = await resolveWikiConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    const absolutePath = resolveWikiChildPath(config.wikiPath, relativePath);
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

export async function writeWikiFile(input: {
    content: string;
    expectedHash: string | null;
    path: string;
}): Promise<WikiFileChange> {
    const config = await resolveWikiConfig();
    const relativePath = normalizeWritableMarkdownPath(input.path);
    assertNotCoreMemoryBasename(relativePath);
    const absolutePath = resolveWikiChildPath(config.wikiPath, relativePath);
    return withWikiPathWriteLock(config.wikiPath, async () => {
        const previous = await fs.readFile(absolutePath, 'utf8').catch((error) => {
            if (isNotFoundError(error)) {
                return null;
            }
            throw error;
        });
        const beforeHash = previous === null ? null : sha256(previous);
        if (
            beforeHash === null &&
            input.expectedHash === null &&
            (await wasWikiPathDeletedRecently(config.wikiPath, relativePath))
        ) {
            throw new Error('Wiki page was deleted recently and cannot be recreated by dreaming.');
        }
        if (beforeHash !== input.expectedHash) {
            throw new Error('Wiki page changed since it was read.');
        }

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, input.content);
        await commitWikiHistory(config.wikiPath, { reason: 'write file' });
        return {
            afterHash: sha256(input.content),
            beforeHash,
            path: relativePath,
        };
    });
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

export async function deleteWikiFolder(input: WikiPathInput): Promise<WikiPathMutationResult> {
    const config = await resolveWikiConfig();
    const relativePath = normalizeWritableFolderPath(input.path);
    const absolutePath = resolveWikiChildPath(config.wikiPath, relativePath);
    return withWikiPathWriteLock(config.wikiPath, async () => {
        const stat = await fs.stat(absolutePath).catch(() => null);
        if (!stat?.isDirectory()) {
            throw new Error('Wiki folder does not exist.');
        }

        await commitWikiHistory(config.wikiPath, { reason: 'baseline' });
        await fs.rm(absolutePath, { recursive: true });
        await commitWikiHistory(config.wikiPath, { reason: 'delete folder' });
        return { kind: 'folder' as const, page: null, path: relativePath };
    });
}

export async function moveWikiPath(input: WikiMovePath): Promise<WikiPathMutationResult> {
    const config = await resolveWikiConfig();
    const fromPath =
        input.kind === 'page'
            ? normalizeWritableMarkdownPath(input.fromPath)
            : normalizeWritableFolderPath(input.fromPath);
    const toPath =
        input.kind === 'page'
            ? normalizeWritableMarkdownPath(input.toPath)
            : normalizeWritableFolderPath(input.toPath);
    const fromAbsolutePath = resolveWikiChildPath(config.wikiPath, fromPath);
    const toAbsolutePath = resolveWikiChildPath(config.wikiPath, toPath);
    return withWikiPathWriteLock(config.wikiPath, async () => {
        const sourceStat = await fs.stat(fromAbsolutePath).catch(() => null);
        const targetStat = await fs.stat(toAbsolutePath).catch(() => null);

        if (input.kind === 'page' && !(sourceStat?.isFile() && fromAbsolutePath.endsWith('.md'))) {
            throw new Error('Wiki page does not exist.');
        }
        if (input.kind === 'folder' && !sourceStat?.isDirectory()) {
            throw new Error('Wiki folder does not exist.');
        }
        if (targetStat) {
            throw new Error('A Wiki item already exists at that path.');
        }
        if (
            input.kind === 'folder' &&
            (toAbsolutePath === fromAbsolutePath ||
                toAbsolutePath.startsWith(`${fromAbsolutePath}${path.sep}`))
        ) {
            throw new Error('Wiki folder cannot be moved into itself.');
        }

        await commitWikiHistory(config.wikiPath, { reason: 'baseline' });
        await fs.mkdir(path.dirname(toAbsolutePath), { recursive: true });
        if (input.kind === 'page') {
            await copyMovedPageAttachments({
                fromPath,
                toPath,
                wikiPath: config.wikiPath,
            });
        }
        await fs.rename(fromAbsolutePath, toAbsolutePath);
        await commitWikiHistory(config.wikiPath, { reason: 'move path' });

        if (input.kind === 'page') {
            const file = await toMarkdownFile(config.wikiPath, toAbsolutePath);
            return { kind: 'page' as const, page: toPage(file), path: toPath };
        }

        return { kind: 'folder' as const, page: null, path: toPath };
    });
}

export async function searchWiki(input: WikiSearchInput): Promise<WikiSearchResult> {
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

export async function listWikiBacklinks(input: { path: string }): Promise<WikiBacklinkList> {
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

export async function resolveWikiConfig(): Promise<WikiConfig> {
    return resolveWikiConfigSync();
}

export function resolveWikiConfigSync(): WikiConfig {
    const environmentPath = readConfigValue('TAVERN_WIKI_PATH');
    if (environmentPath) {
        return {
            configuredPath: null,
            environmentPath,
            source: 'environment',
            updatedAt: null,
            wikiPath: resolveConfiguredPath(environmentPath),
        };
    }

    const settings = readStoredWikiSettings();
    if (settings) {
        return {
            configuredPath: settings.wikiPath,
            environmentPath: null,
            source: 'settings',
            updatedAt: settings.updatedAt,
            wikiPath: resolveConfiguredPath(settings.wikiPath),
        };
    }

    return {
        configuredPath: null,
        environmentPath: null,
        source: 'default',
        updatedAt: null,
        wikiPath: resolveConfiguredPath(defaultWikiPath),
    };
}

function readStoredWikiSettings(): { updatedAt: string; wikiPath: string } | null {
    let row: { updated_at: string; value: string } | undefined;
    try {
        row = getDb()
            .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
            .get(namedParams({ key: wikiSettingsMetadataKey })) as
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

    const parsed = JSON.parse(row.value) as { wikiPath?: unknown };
    if (typeof parsed.wikiPath !== 'string' || parsed.wikiPath.trim().length === 0) {
        throw new Error('Stored Wiki settings are invalid; re-save them.');
    }

    return { updatedAt: row.updated_at, wikiPath: parsed.wikiPath.trim() };
}

async function listMarkdownFiles(wikiPath: string): Promise<MarkdownFile[]> {
    const files = await walkMarkdown(wikiPath);
    return await Promise.all(files.map((file) => toMarkdownFile(wikiPath, file)));
}

async function listWikiFolders(wikiPath: string) {
    const folders = await walkFolders(wikiPath);
    return folders.map((folder) => path.relative(wikiPath, folder));
}

async function readMarkdownFile(wikiPath: string, relativePath: string) {
    const safePath = normalizeRelativeMarkdownPath(relativePath);
    const root = path.resolve(wikiPath);
    const absolutePath = path.resolve(root, safePath);
    if (!isPathInside(absolutePath, root)) {
        return null;
    }
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat?.isFile() && absolutePath.endsWith('.md'))) {
        return null;
    }
    return toMarkdownFile(wikiPath, absolutePath);
}

async function walkMarkdown(root: string): Promise<string[]> {
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
    const files: string[] = [];
    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === '_attachments') {
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
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === '_attachments') {
            continue;
        }
        const entryPath = path.join(root, entry.name);
        folders.push(entryPath, ...(await walkFolders(entryPath)));
    }
    return folders;
}

async function copyMovedPageAttachments(input: {
    fromPath: string;
    toPath: string;
    wikiPath: string;
}) {
    const fromDirectory = path.posix.dirname(input.fromPath);
    const toDirectory = path.posix.dirname(input.toPath);
    if (fromDirectory === toDirectory) {
        return;
    }
    const pageContent = await fs.readFile(
        resolveWikiChildPath(input.wikiPath, input.fromPath),
        'utf8'
    );
    const filenames = new Set(
        Array.from(
            pageContent.matchAll(
                /(?<![a-zA-Z0-9._/-])(?:\.\/)?_attachments\/([^/<>\n]+?\.(?:gif|jpe?g|png|webp))(?=>|\s+["'(]|\))/giu
            ),
            (match) => decodeMovedAttachmentFilename(match[1])
        ).filter((filename): filename is string => Boolean(filename))
    );

    const copies: Array<{ destinationPath: string; sourcePath: string }> = [];
    for (const filename of filenames) {
        const sourcePath = resolveWikiChildPath(
            input.wikiPath,
            path.posix.join(fromDirectory, '_attachments', filename)
        );
        const safeSourcePath = await resolveExistingWikiChildPath(input.wikiPath, sourcePath);
        if (!safeSourcePath) {
            continue;
        }
        const destinationPath = resolveWikiChildPath(
            input.wikiPath,
            path.posix.join(toDirectory, '_attachments', filename)
        );
        const destinationStat = await fs.lstat(destinationPath).catch((error) => {
            if (isNotFoundError(error)) {
                return null;
            }
            throw error;
        });
        if (destinationStat) {
            const safeDestinationPath = await resolveExistingWikiChildPath(
                input.wikiPath,
                destinationPath
            );
            if (!safeDestinationPath) {
                throw new Error('Wiki path must stay inside the Wiki root.');
            }
            const [source, destination] = await Promise.all([
                fs.readFile(safeSourcePath),
                fs.readFile(safeDestinationPath),
            ]);
            if (!source.equals(destination)) {
                throw new Error('A different Wiki attachment already exists at the destination.');
            }
            continue;
        }
        copies.push({ destinationPath, sourcePath: safeSourcePath });
    }

    for (const { destinationPath, sourcePath } of copies) {
        await fs.mkdir(path.dirname(destinationPath), { recursive: true });
        const safeDestinationPath = await resolveWritableWikiChildPath(
            input.wikiPath,
            destinationPath
        );
        await fs
            .copyFile(sourcePath, safeDestinationPath, fsConstants.COPYFILE_EXCL)
            .catch(async (error) => {
                if (!isAlreadyExistsError(error)) {
                    throw error;
                }
                const [source, destination] = await Promise.all([
                    fs.readFile(sourcePath),
                    fs.readFile(safeDestinationPath),
                ]);
                if (!source.equals(destination)) {
                    throw new Error(
                        'A different Wiki attachment already exists at the destination.'
                    );
                }
            });
    }
}

function decodeMovedAttachmentFilename(value: string | undefined) {
    if (!value) {
        return null;
    }
    try {
        const decoded = decodeURIComponent(value);
        return decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')
            ? null
            : decoded;
    } catch {
        return null;
    }
}

async function toMarkdownFile(wikiPath: string, absolutePath: string): Promise<MarkdownFile> {
    const [content, stat] = await Promise.all([
        fs.readFile(absolutePath, 'utf8'),
        fs.stat(absolutePath),
    ]);
    return {
        content,
        mtime: stat.mtime,
        path: absolutePath,
        relativePath: path.relative(wikiPath, absolutePath),
        size: stat.size,
        wikiPath,
    };
}

async function readPages() {
    const list = await listWikiPages();
    const pages = await Promise.all(list.pages.map((page) => getWikiPage({ path: page.path })));
    return pages.filter((page): page is WikiPage => Boolean(page));
}

function toPageSummary(file: MarkdownFile) {
    return toPageSummaryFromPage(toPage(file));
}

function toPageSummaryFromPage(page: WikiPage) {
    return {
        path: page.path,
        title: page.title,
        updatedAt: page.updatedAt,
    };
}

function toPage(file: MarkdownFile): WikiPage {
    const parsed = parseMarkdown(file.content);
    const title =
        readString(parsed.frontmatter.title) ??
        firstHeading(parsed.body) ??
        titleFromPath(file.relativePath);
    return {
        body: parsed.body,
        frontmatter: parsed.frontmatter,
        hash: sha256(file.content),
        links: extractWikiLinks(parsed.body),
        path: file.relativePath,
        size: file.size,
        title,
        updatedAt: file.mtime.toISOString(),
        wikiPath: file.wikiPath,
    };
}

function normalizeWikiAttachmentPath(value: string) {
    const normalized = normalizeWritableRelativePath(value, { allowAttachments: true });
    if (!normalized.split('/').includes('_attachments')) {
        throw new Error('Wiki images must live in an _attachments directory.');
    }
    if (!wikiAttachmentMediaTypeForPath(normalized)) {
        throw new Error('Unsupported Wiki image type.');
    }
    return normalized;
}

function wikiAttachmentMediaTypeForPath(value: string) {
    const extension = path.posix.extname(value).toLowerCase();
    if (extension === '.jpeg') {
        return 'image/jpeg';
    }
    return Object.entries(wikiAttachmentExtensionByMediaType).find(
        ([, candidate]) => candidate === extension
    )?.[0] as keyof typeof wikiAttachmentExtensionByMediaType | undefined;
}

function attachmentStem(filename: string) {
    const stem = path.posix.basename(filename, path.posix.extname(filename));
    return (
        stem
            .normalize('NFKD')
            .replace(/[^a-zA-Z0-9]+/gu, '-')
            .replace(/^-+|-+$/gu, '')
            .toLowerCase()
            .slice(0, 80) || 'image'
    );
}

function normalizeBase64(value: string) {
    return value.replace(/\s+/gu, '').replace(/=+$/u, (padding) => padding.slice(0, 2));
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

function serializeMarkdownDocument(body: string, frontmatter?: Record<string, unknown>) {
    if (!frontmatter || Object.keys(frontmatter).length === 0) {
        return body;
    }
    return `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n${body}`;
}

function parseFrontmatter(value: string): Record<string, unknown> {
    const parsed = parseYaml(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
}

function extractWikiLinks(content: string): WikiPage['links'] {
    return Array.from(content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/gu)).map(
        (match) => ({
            label: match[2]?.trim() || null,
            target: match[1]?.trim() ?? '',
        })
    );
}

function extractLinkTargets(content: string): WikiPage['links'] {
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

export function normalizeRelativeMarkdownPath(value: string) {
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
        throw new Error('Wiki folder paths must not end in .md.');
    }
    return normalized;
}

function normalizeWritableRelativePath(
    value: string,
    options: { allowAttachments?: boolean } = {}
) {
    const trimmed = value.trim().replaceAll('\\', '/');
    const segments = trimmed.split('/');
    if (
        !trimmed ||
        trimmed.startsWith('/') ||
        segments.some(
            (segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.')
        )
    ) {
        throw new Error('Wiki path must stay inside the Wiki root and avoid dot directories.');
    }
    if (!options.allowAttachments && segments.includes('_attachments')) {
        throw new Error('Wiki attachment directories are managed by Grotto.');
    }

    const normalized = path.posix.normalize(trimmed);
    if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
        throw new Error('Wiki path must stay inside the Wiki root.');
    }

    return normalized;
}

export function resolveWikiChildPath(wikiPath: string, relativePath: string) {
    const root = path.resolve(wikiPath);
    const absolutePath = path.resolve(root, ...relativePath.split('/'));
    if (!isPathInside(absolutePath, root)) {
        throw new Error('Wiki path must stay inside the Wiki root.');
    }
    return absolutePath;
}

async function resolveExistingWikiChildPath(wikiPath: string, absolutePath: string) {
    const [realRoot, realPath] = await Promise.all([
        fs.realpath(wikiPath),
        fs.realpath(absolutePath).catch((error) => {
            if (isNotFoundError(error)) {
                return null;
            }
            throw error;
        }),
    ]);
    return realPath && isPathInside(realPath, realRoot) ? realPath : null;
}

async function resolveWritableWikiChildPath(wikiPath: string, absolutePath: string) {
    const [realRoot, realParent] = await Promise.all([
        fs.realpath(wikiPath),
        fs.realpath(path.dirname(absolutePath)),
    ]);
    if (!isPathInside(realParent, realRoot)) {
        throw new Error('Wiki path must stay inside the Wiki root.');
    }
    return path.join(realParent, path.basename(absolutePath));
}

function isPathInside(filePath: string, root: string) {
    return filePath === root || filePath.startsWith(`${root}${path.sep}`);
}

/** Core memory files are per-agent workspace files; there is no shared USER.md or MEMORY.md. */
function assertNotCoreMemoryBasename(relativePath: string) {
    const basename = relativePath.split('/').at(-1)?.toUpperCase() ?? '';
    if (basename === 'USER.MD' || basename === 'MEMORY.MD') {
        throw new Error(
            'Core memory files do not live in Wiki. Write the agent’s own USER.md or MEMORY.md instead.'
        );
    }
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

function sha256(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256Buffer(value: Buffer) {
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

function isAlreadyExistsError(error: unknown) {
    return Boolean(
        error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code?: unknown }).code === 'EEXIST'
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
    page: WikiPage;
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
