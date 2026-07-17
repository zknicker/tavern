import type { WikiPageCommit, WikiPageHistory, WikiPageRevision } from '@tavern/api';
import { ensureWikiHistory, runGit } from './history.ts';
import { normalizeRelativeMarkdownPath, resolveWikiChildPath, resolveWikiConfig } from './store.ts';

// Read-only Git history for Wiki pages: the commit list touching one page and
// each commit's before/after content. Runtime commits around every Wiki
// mutation (history.ts), so this is pure projection over the local repo.

const defaultHistoryLimit = 50;
const maxHistoryLimit = 200;
const revisionTextMaxBytes = 256 * 1024;
const commitHashPattern = /^[0-9a-f]{4,40}$/iu;
const commitFieldSeparator = '\u001f';

export async function getWikiPageHistory(input: {
    limit?: number;
    path: string;
}): Promise<WikiPageHistory> {
    const { relativePath, wikiPath } = await resolvePagePath(input.path);
    const status = await ensureWikiHistory(wikiPath);
    if (!status.ready) {
        return { commits: [], path: relativePath, ready: false, reason: status.reason };
    }

    const limit = Math.min(
        Math.max(1, Math.trunc(input.limit ?? defaultHistoryLimit)),
        maxHistoryLimit
    );
    try {
        const result = await runGit(wikiPath, [
            'log',
            `--format=%H${commitFieldSeparator}%cI${commitFieldSeparator}%s`,
            '-n',
            String(limit),
            '--',
            relativePath,
        ]);
        return {
            commits: parseCommitLines(result.stdout),
            path: relativePath,
            ready: true,
            reason: null,
        };
    } catch (error) {
        return {
            commits: [],
            path: relativePath,
            ready: false,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}

export async function getWikiPageRevision(input: {
    commit: string;
    path: string;
}): Promise<WikiPageRevision> {
    const { relativePath, wikiPath } = await resolvePagePath(input.path);
    if (!commitHashPattern.test(input.commit)) {
        throw new Error('Wiki revision must be a commit hash.');
    }
    const status = await ensureWikiHistory(wikiPath);
    if (!status.ready) {
        return {
            afterText: null,
            beforeText: null,
            commit: null,
            path: relativePath,
            ready: false,
            reason: status.reason,
        };
    }

    const [commit, beforeText, afterText] = await Promise.all([
        readCommit(wikiPath, input.commit),
        readRevisionText(wikiPath, `${input.commit}^`, relativePath),
        readRevisionText(wikiPath, input.commit, relativePath),
    ]);
    return {
        afterText,
        beforeText,
        commit,
        path: relativePath,
        ready: true,
        reason: null,
    };
}

async function resolvePagePath(value: string) {
    const config = await resolveWikiConfig();
    const relativePath = normalizeRelativeMarkdownPath(value).replaceAll('\\', '/');
    // Containment check only; the page may no longer exist on disk.
    resolveWikiChildPath(config.wikiPath, relativePath);
    return { relativePath, wikiPath: config.wikiPath };
}

async function readCommit(wikiPath: string, commit: string): Promise<null | WikiPageCommit> {
    try {
        const result = await runGit(wikiPath, [
            'show',
            '-s',
            `--format=%H${commitFieldSeparator}%cI${commitFieldSeparator}%s`,
            commit,
        ]);
        return parseCommitLines(result.stdout)[0] ?? null;
    } catch {
        return null;
    }
}

async function readRevisionText(wikiPath: string, revision: string, relativePath: string) {
    try {
        const result = await runGit(wikiPath, ['show', `${revision}:${relativePath}`]);
        if (result.stdout.includes('\u0000') || result.stdout.length > revisionTextMaxBytes) {
            return null;
        }
        return result.stdout;
    } catch {
        // The page does not exist at this revision (created/deleted commit,
        // or a root commit with no parent).
        return null;
    }
}

function parseCommitLines(stdout: string): WikiPageCommit[] {
    return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => {
            const [hash, committedAt, subject] = line.split(commitFieldSeparator);
            if (!(hash && committedAt)) {
                return [];
            }
            return [{ committedAt, hash, subject: subject ?? '' }];
        });
}
