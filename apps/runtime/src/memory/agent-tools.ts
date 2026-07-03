import type { ToolSet } from '@ai-sdk/provider-utils';
import { tool } from 'ai';
import * as z from 'zod';
import {
    listSemanticMemoryPages,
    readSemanticMemoryFile,
    searchSemanticMemory,
    writeSemanticMemoryFile,
} from './semantic/store.ts';

/**
 * Shared Semantic Memory tools for normal agent turns. Exposed only when
 * global Memory is enabled; writes are for explicit user-requested Memory
 * work, routed by TAXONOMY.md. Core memory files stay agent workspace files and
 * are edited with workspace file tools, not these.
 */
export function createTavernMemoryTools(): ToolSet {
    return {
        memory_list_pages: tool({
            description:
                'List shared Memory pages and folders — the durable knowledge base shared by all agents. Read TAXONOMY.md for routing rules before writing.',
            inputSchema: z.object({}),
            execute: async () => await listSemanticMemoryPages(),
        }),
        memory_search: tool({
            description:
                'Search shared Memory pages by title, tags, aliases, and text. Use this whenever the user references something you lack context on — durable knowledge from past sessions may already cover it.',
            inputSchema: z.object({
                limit: z.number().int().positive().max(50).optional(),
                query: z.string().min(1),
            }),
            execute: async ({ limit, query }) =>
                await searchSemanticMemory({ limit: limit ?? 10, query }),
        }),
        memory_read_page: tool({
            description: 'Read one shared Semantic Memory Markdown file with its current hash.',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
            execute: async ({ path }) => await readSemanticMemoryFile({ path }),
        }),
        memory_write_page: tool({
            description:
                'Write one shared Semantic Memory Markdown file. Use only for explicit user-requested Memory work, with the hash returned by memory_read_page (null when creating a new page). Preserve frontmatter and user-authored content; append History entries before changing Current.',
            inputSchema: z.object({
                content: z.string(),
                expectedHash: z.string().nullable(),
                path: z.string().min(1),
            }),
            execute: async ({ content, expectedHash, path }) =>
                await writeSemanticMemoryFile({ content, expectedHash, path }),
        }),
    };
}
