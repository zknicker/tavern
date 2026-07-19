import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    AgentRuntimeWorkspaceFileContent,
    AgentRuntimeWorkspaceFileEntry,
    AgentRuntimeWorkspaceFileList,
} from '@tavern/api';
import type { Database } from '../db/sqlite.ts';
import { getAgentWorkspaceSource } from './instructions.ts';
import {
    isHiddenWorkspaceName,
    isSensitiveWorkspacePath,
    isSkippedWorkspaceDirectory,
    looksBinary,
} from './visibility.ts';

const imageExtensions = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const dataUrlReadMaxBytes = 16 * 1024 * 1024;
const textSourceMaxBytes = 64 * 1024 * 1024;
const textPreviewMaxBytes = 512 * 1024;
// HTML previews render whole documents in sandboxed iframes (artifact pane and
// the html-preview widget), so they get a larger complete-read window.
const htmlPreviewMaxBytes = 5 * 1024 * 1024;

const languageByExtension: Record<string, string> = {
    '.c': 'c',
    '.conf': 'ini',
    '.cpp': 'cpp',
    '.css': 'css',
    '.csv': 'csv',
    '.go': 'go',
    '.graphql': 'graphql',
    '.h': 'c',
    '.hpp': 'cpp',
    '.html': 'html',
    '.java': 'java',
    '.js': 'javascript',
    '.json': 'json',
    '.jsx': 'jsx',
    '.log': 'text',
    '.lua': 'lua',
    '.md': 'markdown',
    '.mjs': 'javascript',
    '.py': 'python',
    '.rb': 'ruby',
    '.rs': 'rust',
    '.sh': 'shell',
    '.sql': 'sql',
    '.svg': 'xml',
    '.toml': 'toml',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.txt': 'text',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.zsh': 'shell',
};

const mediaTypeByExtension: Record<string, string> = {
    '.bmp': 'image/bmp',
    '.css': 'text/css',
    '.csv': 'text/csv',
    '.gif': 'image/gif',
    '.htm': 'text/html',
    '.html': 'text/html',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.mjs': 'text/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.webp': 'image/webp',
    '.xml': 'application/xml',
};

export async function listWorkspaceFiles(
    db: Database,
    input: { agentId: string; path?: string | null }
): Promise<AgentRuntimeWorkspaceFileList> {
    const root = await resolveWorkspaceRoot(db, input.agentId);
    const relativePath = normalizeWorkspacePath(input.path ?? '', { allowEmpty: true });
    rejectUnbrowseableWorkspacePath(relativePath);
    const directory = await resolveWorkspaceChild(root, relativePath);
    const stat = await fs.stat(directory).catch(() => null);
    if (!stat?.isDirectory()) {
        throw new Error('Workspace directory does not exist.');
    }

    const entries = await fs.readdir(directory, { withFileTypes: true });
    const visibleEntries = await Promise.all(
        entries.filter(isVisibleEntry).map((entry) => toWorkspaceEntry(root, relativePath, entry))
    );

    return {
        entries: visibleEntries
            .filter((entry): entry is AgentRuntimeWorkspaceFileEntry => Boolean(entry))
            .sort(compareWorkspaceEntries),
        path: relativePath,
        workspaceRoot: root,
    };
}

// Existence probe with the same confinement rules as listing/reading; used to
// validate pane targets before they are persisted.
export async function workspacePathExists(
    db: Database,
    input: { agentId: string; kind: 'directory' | 'file'; path: string }
): Promise<boolean> {
    try {
        const root = await resolveWorkspaceRoot(db, input.agentId);
        const relativePath = normalizeWorkspacePath(input.path, {
            allowEmpty: input.kind === 'directory',
        });
        rejectUnbrowseableWorkspacePath(relativePath);
        if (input.kind === 'file') {
            rejectSensitiveWorkspacePath(relativePath);
        }
        const absolutePath = await resolveWorkspaceChild(root, relativePath);
        const stat = await fs.stat(absolutePath).catch(() => null);
        return input.kind === 'file' ? Boolean(stat?.isFile()) : Boolean(stat?.isDirectory());
    } catch {
        return false;
    }
}

export async function readWorkspaceFile(
    db: Database,
    input: { agentId: string; path: string }
): Promise<AgentRuntimeWorkspaceFileContent> {
    const root = await resolveWorkspaceRoot(db, input.agentId);
    const relativePath = normalizeWorkspacePath(input.path, { allowEmpty: false });
    rejectSensitiveWorkspacePath(relativePath);
    // Direct reads may follow links into legacy harness session directories,
    // which stay hidden from listings; dot directories remain unreadable.
    rejectUnbrowseableWorkspacePath(relativePath, { allowSkippedDirectories: true });
    const absolutePath = await resolveWorkspaceChild(root, relativePath);

    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) {
        throw new Error('Workspace file does not exist.');
    }

    const extension = path.extname(relativePath).toLowerCase();
    const mediaType = mediaTypeForPath(relativePath);
    const updatedAt = stat.mtime.toISOString();

    if (imageExtensions.has(extension)) {
        if (stat.size > dataUrlReadMaxBytes) {
            throw new Error('Workspace image is too large to preview.');
        }
        return {
            binary: true,
            content: (await fs.readFile(absolutePath)).toString('base64'),
            encoding: 'base64',
            language: null,
            mediaType,
            path: relativePath,
            sizeBytes: stat.size,
            truncated: false,
            updatedAt,
            workspaceRoot: root,
        };
    }

    if (stat.size > textSourceMaxBytes) {
        throw new Error('Workspace file is too large to preview.');
    }

    const previewMaxBytes = mediaType === 'text/html' ? htmlPreviewMaxBytes : textPreviewMaxBytes;
    const handle = await fs.open(absolutePath, 'r');
    try {
        const bytesToRead = Math.min(stat.size, previewMaxBytes);
        const buffer = Buffer.alloc(bytesToRead);
        const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
        const data = buffer.subarray(0, bytesRead);
        return {
            binary: looksBinary(data.subarray(0, Math.min(data.length, 4096))),
            content: data.toString('utf8'),
            encoding: 'utf8',
            language: languageByExtension[extension] ?? 'text',
            mediaType,
            path: relativePath,
            sizeBytes: stat.size,
            truncated: stat.size > previewMaxBytes,
            updatedAt,
            workspaceRoot: root,
        };
    } finally {
        await handle.close();
    }
}

async function resolveWorkspaceRoot(db: Database, agentId: string) {
    const source = getAgentWorkspaceSource(db, agentId);
    if (!source) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }
    return await fs.realpath(source.workspaceDir);
}

async function resolveWorkspaceChild(root: string, relativePath: string) {
    const absolutePath = path.resolve(root, ...relativePath.split('/').filter(Boolean));
    const realPath = await fs.realpath(absolutePath);
    if (!isPathInside(realPath, root)) {
        throw new Error('Workspace path must stay inside the workspace.');
    }
    return realPath;
}

function normalizeWorkspacePath(value: string, { allowEmpty }: { allowEmpty: boolean }) {
    const trimmed = value.trim().replaceAll('\\', '/');
    if (!trimmed) {
        if (allowEmpty) {
            return '';
        }
        throw new Error('Workspace path is required.');
    }
    if (trimmed.startsWith('/')) {
        throw new Error('Workspace path must be relative.');
    }
    const segments = trimmed.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw new Error('Workspace path must stay inside the workspace.');
    }
    const normalized = path.posix.normalize(trimmed);
    if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
        throw new Error('Workspace path must stay inside the workspace.');
    }
    return normalized;
}

function isVisibleEntry(entry: Dirent) {
    if (isHiddenWorkspaceName(entry.name)) {
        return false;
    }
    if (entry.isDirectory() && isSkippedWorkspaceDirectory(entry.name)) {
        return false;
    }
    return true;
}

function rejectUnbrowseableWorkspacePath(
    relativePath: string,
    options: { allowSkippedDirectories?: boolean } = {}
) {
    if (!relativePath) {
        return;
    }
    for (const segment of relativePath.split('/')) {
        if (isHiddenWorkspaceName(segment)) {
            throw new Error('Workspace path is not browseable.');
        }
        if (!options.allowSkippedDirectories && isSkippedWorkspaceDirectory(segment)) {
            throw new Error('Workspace path is not browseable.');
        }
    }
}

async function toWorkspaceEntry(
    root: string,
    parentPath: string,
    entry: Dirent
): Promise<AgentRuntimeWorkspaceFileEntry | null> {
    if (entry.isSymbolicLink()) {
        return null;
    }
    const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const absolutePath = await resolveWorkspaceChild(root, relativePath).catch(() => null);
    if (!absolutePath) {
        return null;
    }
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat && (stat.isDirectory() || stat.isFile()))) {
        return null;
    }
    return {
        kind: stat.isDirectory() ? 'directory' : 'file',
        mediaType: stat.isFile() ? mediaTypeForPath(relativePath) : null,
        name: entry.name,
        path: relativePath,
        sizeBytes: stat.isFile() ? stat.size : null,
        updatedAt: stat.mtime.toISOString(),
    };
}

function compareWorkspaceEntries(
    left: AgentRuntimeWorkspaceFileEntry,
    right: AgentRuntimeWorkspaceFileEntry
) {
    if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
}

function rejectSensitiveWorkspacePath(relativePath: string) {
    if (isSensitiveWorkspacePath(relativePath)) {
        throw new Error(
            'Workspace file is blocked because it may contain secrets or key material.'
        );
    }
}

function mediaTypeForPath(filePath: string) {
    return mediaTypeByExtension[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function isPathInside(filePath: string, root: string) {
    return filePath === root || filePath.startsWith(`${root}${path.sep}`);
}
