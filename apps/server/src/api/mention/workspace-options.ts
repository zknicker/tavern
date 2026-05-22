import fs from 'node:fs/promises';
import path from 'node:path';
import { getAgent as getAgentRecord } from '../../storage/agents.ts';
import type { MentionOptionResult } from './contracts.ts';

const skippedWorkspaceDirectories = new Set([
    '.git',
    '.turbo',
    '.vite',
    'coverage',
    'dist',
    'node_modules',
    'out',
]);

export async function listWorkspacePathMentionOptions({
    agentId,
    limit = 12,
    query,
    workspaceFolder,
}: {
    agentId?: string;
    limit?: number;
    query: string;
    workspaceFolder?: string;
}): Promise<MentionOptionResult[]> {
    const resolvedWorkspaceFolder = workspaceFolder ?? (await resolveAgentWorkspaceFolder(agentId));

    if (!resolvedWorkspaceFolder) {
        return [];
    }

    const normalizedQuery = normalizeQuery(query);
    const roots = workspaceFolder
        ? [resolvedWorkspaceFolder]
        : uniquePaths([resolvedWorkspaceFolder, process.cwd()]);
    const entries = (
        await Promise.all(
            roots.map((root) =>
                walkWorkspace(root, {
                    limit,
                    normalizedQuery,
                })
            )
        )
    ).flat();
    const uniqueEntries = dedupePathEntries(entries);

    return uniqueEntries.map((entry) => ({
        description:
            path.dirname(entry.relativePath) === '.'
                ? resolvedWorkspaceFolder
                : path.dirname(entry.relativePath),
        id: entry.absolutePath,
        insertText: entry.relativePath,
        kind: entry.kind,
        label: entry.relativePath,
        projection: 'path-reference',
        sourceLabel: entry.kind === 'directory' ? 'Folder' : 'File',
    }));
}

async function resolveAgentWorkspaceFolder(agentId: string | undefined) {
    if (!agentId) {
        return null;
    }

    const agent = await getAgentRecord(agentId);
    return agent?.workspaceFolder ?? process.cwd();
}

function dedupePathEntries(
    entries: Array<{
        absolutePath: string;
        kind: 'directory' | 'file';
        relativePath: string;
    }>
) {
    const seen = new Set<string>();

    return entries.filter((entry) => {
        const key = `${entry.kind}:${entry.absolutePath}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function uniquePaths(paths: string[]) {
    return [...new Set(paths)];
}

async function walkWorkspace(
    root: string,
    {
        limit,
        normalizedQuery,
    }: {
        limit: number;
        normalizedQuery: string;
    }
) {
    const results: Array<{
        absolutePath: string;
        kind: 'directory' | 'file';
        relativePath: string;
    }> = [];
    const queue = [''];

    while (queue.length > 0 && results.length < limit) {
        const relativeDir = queue.shift() ?? '';
        const absoluteDir = path.join(root, relativeDir);
        const entries = await readDirectory(absoluteDir);

        for (const entry of entries) {
            if (results.length >= limit) {
                break;
            }

            if (entry.name.startsWith('.') && entry.name !== '.github') {
                continue;
            }

            const relativePath = path.join(relativeDir, entry.name);

            if (entry.isDirectory()) {
                if (!skippedWorkspaceDirectories.has(entry.name)) {
                    queue.push(relativePath);
                }

                if (matchesPathQuery(relativePath, normalizedQuery)) {
                    results.push({
                        absolutePath: path.join(root, relativePath),
                        kind: 'directory',
                        relativePath,
                    });
                }

                continue;
            }

            if (entry.isFile() && matchesPathQuery(relativePath, normalizedQuery)) {
                results.push({
                    absolutePath: path.join(root, relativePath),
                    kind: 'file',
                    relativePath,
                });
            }
        }
    }

    return results.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function matchesPathQuery(relativePath: string, normalizedQuery: string) {
    if (!normalizedQuery) {
        return false;
    }

    return normalizeQuery(relativePath).includes(normalizedQuery);
}

async function readDirectory(directory: string) {
    try {
        return await fs.readdir(directory, { withFileTypes: true });
    } catch {
        return [];
    }
}

function normalizeQuery(value: string) {
    return value.trim().toLowerCase();
}
