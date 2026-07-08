import type { ToolSet } from '@ai-sdk/provider-utils';
import { tool } from 'ai';
import * as z from 'zod';
import { searchWikiPages } from './recall/recall.ts';
import {
    deleteWikiPage,
    listWikiBacklinks,
    listWikiPages,
    moveWikiPath,
    readWikiFile,
    writeWikiFile,
} from './store.ts';

/**
 * Shared Wiki tools for normal agent turns. Writes are for explicit
 * user-requested Wiki work, routed by TAXONOMY.md. Core memory files stay agent
 * workspace files and are edited with workspace file tools, not these.
 */
export function createTavernWikiTools(): ToolSet {
    return {
        wiki_list: tool({
            description:
                'List shared Wiki pages and folders — the durable Markdown knowledge base shared by all agents. Read TAXONOMY.md for routing rules before writing.',
            inputSchema: z.object({}),
            execute: async () => await listWikiPages(),
        }),
        wiki_search: tool({
            description:
                'Search shared Wiki pages with keyword and semantic matching. Use this whenever the user references something you lack context on — durable shared knowledge from past sessions may already cover it.',
            inputSchema: z.object({
                limit: z.number().int().positive().max(50).optional(),
                query: z.string().min(1),
            }),
            execute: async ({ limit, query }) => await searchWikiPages({ limit, query }),
        }),
        wiki_read: tool({
            description: 'Read one shared Wiki Markdown page with its current hash.',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
            execute: async ({ path }) => await readWikiFile({ path }),
        }),
        wiki_write: tool({
            description:
                'Write one shared Wiki Markdown page. Use only for explicit user-requested Wiki work, with the hash returned by wiki_read (null when creating a new page). Preserve frontmatter and user-authored content; append History entries before changing Current.',
            inputSchema: z.object({
                content: z.string(),
                expectedHash: z.string().nullable(),
                path: z.string().min(1),
            }),
            execute: async ({ content, expectedHash, path }) =>
                await writeWikiFile({ content, expectedHash, path }),
        }),
        wiki_move: tool({
            description:
                'Move or rename one shared Wiki page. The result is committed to local Wiki history. Check wiki_backlinks before and after moves when links may need repair.',
            inputSchema: z.object({
                fromPath: z.string().min(1),
                toPath: z.string().min(1),
            }),
            execute: async ({ fromPath, toPath }) =>
                await moveWikiPath({ fromPath, kind: 'page', toPath }),
        }),
        wiki_delete: tool({
            description:
                'Delete one shared Wiki page. The deletion is committed to local Wiki history; use only when the user asked to remove or retire the page.',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
            execute: async ({ path }) => await deleteWikiPage({ path }),
        }),
        wiki_backlinks: tool({
            description:
                'List Wiki pages that link to the target page. Use before moves/deletes to find references that may need repair.',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
            execute: async ({ path }) => await listWikiBacklinks({ path }),
        }),
    };
}
