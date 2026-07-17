import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { log } from '../log.ts';

const execFile = promisify(execFileCallback);
const commitTimeoutMs = 15_000;
const deleteSuppressionWindow = '14 days ago';
const ignoredHistoryEntries = ['.DS_Store', '.obsidian/'];

export interface WikiHistoryResult {
    ready: boolean;
    reason: string | null;
}

export interface WikiCommitResult extends WikiHistoryResult {
    committed: boolean;
}

export async function ensureWikiHistory(wikiPath: string): Promise<WikiHistoryResult> {
    try {
        await fs.mkdir(wikiPath, { recursive: true });
        await assertGitAvailable();

        if (!(await hasOwnGitRepository(wikiPath))) {
            await runGit(wikiPath, ['init']);
        }

        await ensureHistoryIgnoreFile(wikiPath);
        await runGit(wikiPath, ['config', 'user.name', 'Tavern Wiki']);
        await runGit(wikiPath, ['config', 'user.email', 'wiki@tavern.local']);
        return { ready: true, reason: null };
    } catch (error) {
        return unavailable(error instanceof Error ? error.message : String(error));
    }
}

export async function commitWikiHistory(
    wikiPath: string,
    input: { reason: string }
): Promise<WikiCommitResult> {
    const status = await ensureWikiHistory(wikiPath);
    if (!status.ready) {
        warnHistoryUnavailable(wikiPath, status.reason ?? 'unknown');
        return { ...status, committed: false };
    }

    try {
        await runGit(wikiPath, ['add', '--all', '--', '.']);
        if (!(await hasStagedChanges(wikiPath))) {
            return { committed: false, ready: true, reason: null };
        }
        await runGit(wikiPath, ['commit', '-m', `memory: ${input.reason}`]);
        return { committed: true, ready: true, reason: null };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        warnHistoryUnavailable(wikiPath, reason);
        return { committed: false, ready: false, reason };
    }
}

export async function wasWikiPathDeletedRecently(
    wikiPath: string,
    relativePath: string
): Promise<boolean> {
    const status = await ensureWikiHistory(wikiPath);
    if (!status.ready) {
        return false;
    }

    try {
        const result = await runGit(wikiPath, [
            'log',
            '--diff-filter=D',
            '--format=%H',
            '-n',
            '1',
            `--since=${deleteSuppressionWindow}`,
            '--',
            relativePath,
        ]);
        return result.stdout.trim().length > 0;
    } catch {
        return false;
    }
}

async function assertGitAvailable() {
    await execFile('git', ['--version'], { encoding: 'utf8', timeout: commitTimeoutMs });
}

async function hasOwnGitRepository(wikiPath: string) {
    const stat = await fs.stat(path.join(wikiPath, '.git')).catch(() => null);
    return Boolean(stat?.isDirectory() || stat?.isFile());
}

async function ensureHistoryIgnoreFile(wikiPath: string) {
    const ignorePath = path.join(wikiPath, '.gitignore');
    const existing = await fs.readFile(ignorePath, 'utf8').catch(() => '');
    const missingEntries = ignoredHistoryEntries.filter(
        (entry) => !existing.split(/\r?\n/u).includes(entry)
    );
    if (missingEntries.length === 0) {
        return;
    }

    const prefix = existing && !existing.endsWith('\n') ? `${existing}\n` : existing;
    await fs.writeFile(ignorePath, `${prefix}${missingEntries.join('\n')}\n`);
}

async function hasStagedChanges(wikiPath: string) {
    try {
        await runGit(wikiPath, ['diff', '--cached', '--quiet']);
        return false;
    } catch (error) {
        if (isExitCode(error, 1)) {
            return true;
        }
        throw error;
    }
}

export async function runGit(wikiPath: string, args: string[]) {
    return await execFile('git', ['-C', wikiPath, ...args], {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        timeout: commitTimeoutMs,
    });
}

function unavailable(reason: string): WikiHistoryResult {
    return { ready: false, reason };
}

function isExitCode(error: unknown, code: number) {
    return Boolean(
        error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code?: unknown }).code === code
    );
}

const warnedHistoryFailures = new Set<string>();

function warnHistoryUnavailable(wikiPath: string, reason: string) {
    const warningKey = `${wikiPath}:${reason}`;
    if (warnedHistoryFailures.has(warningKey)) {
        return;
    }
    warnedHistoryFailures.add(warningKey);
    log.warn('Wiki local history unavailable', { wikiPath, reason });
}
