import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { structuredPatch } from 'diff';
import {
    isHiddenWorkspaceName,
    isSensitiveWorkspacePath,
    isSkippedWorkspaceDirectory,
    looksBinary,
} from './visibility.ts';

// Point-in-time view of the visible text surface of an agent workspace.
// Captured before a turn runs and again when it settles; the compared pair is
// the turn's file-change evidence (created/modified/deleted + before/after).
export interface WorkspaceSnapshot {
    entries: Map<string, WorkspaceSnapshotEntry>;
    // A capped walk cannot prove the change set is complete.
    truncated: boolean;
}

export interface WorkspaceSnapshotEntry {
    binary: boolean;
    identity: string;
    sizeBytes: number;
    text: null | string;
}

export type WorkspaceFileChangeKind = 'created' | 'deleted' | 'modified';

export interface WorkspaceFileChange {
    additions: number;
    afterSize: null | number;
    afterText: null | string;
    beforeSize: null | number;
    beforeText: null | string;
    change: WorkspaceFileChangeKind;
    deletions: number;
    omitted: 'binary' | 'too-large' | null;
    path: string;
}

// Engine-managed plumbing rewritten around turns (the harness CLI tool-relay
// shim carries a fresh local port and token per session). Not agent work, so
// never file-change evidence.
const engineManagedFileNames = new Set(['harness-tool.mjs']);

// Diffable text is retained up to this size per side; larger or binary files
// still detect as changed but carry no content.
const textRetainMaxBytes = 256 * 1024;
// Files above this size are identified by size+mtime instead of content hash.
const hashReadMaxBytes = 4 * 1024 * 1024;
const snapshotMaxFiles = 4000;

export async function captureWorkspaceSnapshot(root: string): Promise<WorkspaceSnapshot> {
    const snapshot: WorkspaceSnapshot = { entries: new Map(), truncated: false };
    await walkDirectory(root, '', snapshot);
    return snapshot;
}

export function diffWorkspaceSnapshots(
    before: WorkspaceSnapshot,
    after: WorkspaceSnapshot
): WorkspaceFileChange[] {
    const paths = new Set([...before.entries.keys(), ...after.entries.keys()]);
    const changes: WorkspaceFileChange[] = [];

    for (const filePath of [...paths].sort()) {
        const beforeEntry = before.entries.get(filePath) ?? null;
        const afterEntry = after.entries.get(filePath) ?? null;
        if (beforeEntry && afterEntry && beforeEntry.identity === afterEntry.identity) {
            continue;
        }
        changes.push(toFileChange(filePath, beforeEntry, afterEntry));
    }

    return changes;
}

async function walkDirectory(root: string, relativePath: string, snapshot: WorkspaceSnapshot) {
    if (snapshot.truncated) {
        return;
    }
    const absolutePath = relativePath ? path.join(root, relativePath) : root;
    const entries = await fs.readdir(absolutePath, { withFileTypes: true }).catch(() => []);

    for (const entry of sortEntries(entries)) {
        if (snapshot.truncated) {
            return;
        }
        if (entry.isSymbolicLink() || isHiddenWorkspaceName(entry.name)) {
            continue;
        }
        const childPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            if (!isSkippedWorkspaceDirectory(entry.name)) {
                await walkDirectory(root, childPath, snapshot);
            }
            continue;
        }
        if (
            !entry.isFile() ||
            engineManagedFileNames.has(entry.name) ||
            isSensitiveWorkspacePath(childPath)
        ) {
            continue;
        }
        if (snapshot.entries.size >= snapshotMaxFiles) {
            snapshot.truncated = true;
            return;
        }
        const snapshotEntry = await captureFile(path.join(root, childPath));
        if (snapshotEntry) {
            snapshot.entries.set(childPath, snapshotEntry);
        }
    }
}

async function captureFile(absolutePath: string): Promise<null | WorkspaceSnapshotEntry> {
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) {
        return null;
    }
    if (stat.size > hashReadMaxBytes) {
        return {
            binary: false,
            identity: `size:${stat.size}:mtime:${stat.mtimeMs}`,
            sizeBytes: stat.size,
            text: null,
        };
    }

    const data = await fs.readFile(absolutePath).catch(() => null);
    if (data === null) {
        return null;
    }
    const binary = looksBinary(data.subarray(0, Math.min(data.length, 4096)));
    return {
        binary,
        identity: `sha256:${createHash('sha256').update(data).digest('hex')}`,
        sizeBytes: data.length,
        text: binary || data.length > textRetainMaxBytes ? null : data.toString('utf8'),
    };
}

function toFileChange(
    filePath: string,
    before: null | WorkspaceSnapshotEntry,
    after: null | WorkspaceSnapshotEntry
): WorkspaceFileChange {
    const change: WorkspaceFileChangeKind = before ? (after ? 'modified' : 'deleted') : 'created';
    const omitted =
        before?.binary || after?.binary
            ? ('binary' as const)
            : (before && before.text === null) || (after && after.text === null)
              ? ('too-large' as const)
              : null;
    const beforeText = omitted ? null : (before?.text ?? null);
    const afterText = omitted ? null : (after?.text ?? null);

    return {
        ...countLineChanges(beforeText, afterText),
        afterSize: after?.sizeBytes ?? null,
        afterText,
        beforeSize: before?.sizeBytes ?? null,
        beforeText,
        change,
        omitted,
        path: filePath,
    };
}

function countLineChanges(beforeText: null | string, afterText: null | string) {
    if (beforeText === null && afterText === null) {
        return { additions: 0, deletions: 0 };
    }
    const patch = structuredPatch('before', 'after', beforeText ?? '', afterText ?? '');
    let additions = 0;
    let deletions = 0;
    for (const hunk of patch.hunks) {
        for (const line of hunk.lines) {
            if (line.startsWith('+')) {
                additions += 1;
            } else if (line.startsWith('-')) {
                deletions += 1;
            }
        }
    }
    return { additions, deletions };
}

function sortEntries(entries: Dirent[]) {
    return [...entries].sort((left, right) => left.name.localeCompare(right.name));
}
