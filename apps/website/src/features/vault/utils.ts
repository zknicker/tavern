import type { VaultListOutput } from '../../lib/trpc.tsx';
import type { VaultPageNode } from './types.ts';

export type VaultPageTreeNode = VaultPageTreeDirectory | VaultPageTreeFile;

export interface VaultPageTreeDirectory {
    children: VaultPageTreeNode[];
    id: string;
    kind: 'directory';
    name: string;
}

export interface VaultPageTreeFile {
    id: string;
    kind: 'file';
    name: string;
    page: VaultPageNode;
}

export function filterPages(pages: VaultPageNode[], query: string) {
    const terms = query.trim().toLowerCase();
    if (!terms) {
        return pages;
    }

    return pages.filter((page) => [page.title, page.path].join(' ').toLowerCase().includes(terms));
}

export function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function resolveSelectedPage(list: VaultListOutput, selected: { path: string } | null) {
    if (selected) {
        const exact = list.pages.find((page) => page.path === selected.path);
        if (exact) {
            return exact;
        }
    }
    return list.pages.find((page) => page.path === 'MEMORY.md') ?? list.pages[0] ?? null;
}

export function pageKey(page: Pick<VaultPageNode, 'path'>) {
    return page.path;
}

export function resolveVaultLinkTarget(
    pages: VaultPageNode[],
    currentPage: { path: string },
    target: string
): VaultPageNode | null {
    if (target.includes('/')) {
        const resolvedPath = resolveRelativePagePath(currentPage.path, target);
        const byPath = pages.find((page) => page.path === resolvedPath);
        if (byPath) {
            return byPath;
        }
    }

    const slug = pageSlug(target);
    return pages.find((page) => pageSlug(page.path) === slug) ?? null;
}

export function joinVaultPath(parentPath: string | undefined, childPath: string) {
    const normalizedChild = normalizeDialogPath(childPath);
    if (!parentPath) {
        return normalizedChild;
    }
    return `${normalizeDialogPath(parentPath)}/${normalizedChild}`;
}

export function normalizeDialogPath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}

export function lastPathSegment(path: string) {
    return normalizeDialogPath(path).split('/').at(-1) ?? path;
}

export function isPathInFolder(path: string, folderPath: string) {
    return path === folderPath || path.startsWith(`${folderPath}/`);
}

export function replacePathPrefix(path: string, fromPrefix: string, toPrefix: string) {
    if (!isPathInFolder(path, fromPrefix)) {
        return path;
    }
    return `${toPrefix}${path.slice(fromPrefix.length)}`;
}

export function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Memory update failed.';
}

function pageSlug(value: string) {
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

function resolveRelativePagePath(fromPath: string, target: string) {
    const base = fromPath.split('/').slice(0, -1);
    for (const segment of target.split('/')) {
        if (segment === '' || segment === '.') {
            continue;
        }
        if (segment === '..') {
            base.pop();
            continue;
        }
        base.push(segment);
    }
    return base.join('/');
}

export function buildVaultPageTree(
    pages: VaultPageNode[],
    folders: string[] = []
): VaultPageTreeNode[] {
    const root = createInternalDirectory('', '');

    for (const folderPath of folders) {
        let parent = root;
        const directorySegments: string[] = [];
        for (const segment of splitTreePath(folderPath)) {
            directorySegments.push(segment);
            parent = getOrCreateDirectory(parent, directorySegments.join('/'), segment);
        }
    }

    for (const page of pages) {
        const segments = splitTreePath(page.path);
        const fileName = removeMarkdownExtension(segments.at(-1) ?? page.title);
        let parent = root;
        const directorySegments: string[] = [];

        for (const segment of segments.slice(0, -1)) {
            directorySegments.push(segment);
            const directoryId = directorySegments.join('/');
            parent = getOrCreateDirectory(parent, directoryId, segment);
        }

        parent.children.push({
            id: pageKey(page),
            kind: 'file',
            name: fileName,
            page,
        });
    }

    return finalizeTree(root.children);
}

export function getVaultDirectoryIds(nodes: VaultPageTreeNode[]) {
    return nodes.flatMap((node): string[] => {
        if (node.kind === 'file') {
            return [];
        }
        return [node.id, ...getVaultDirectoryIds(node.children)];
    });
}

interface InternalDirectory {
    children: VaultPageTreeNode[];
    directories: Map<string, InternalDirectory>;
    id: string;
    kind: 'directory';
    name: string;
}

function createInternalDirectory(id: string, name: string): InternalDirectory {
    return {
        children: [],
        directories: new Map(),
        id,
        kind: 'directory',
        name,
    };
}

function getOrCreateDirectory(
    parent: InternalDirectory,
    directoryId: string,
    name: string
): InternalDirectory {
    const existing = parent.directories.get(directoryId);
    if (existing) {
        return existing;
    }

    const directory = createInternalDirectory(directoryId, name);
    parent.directories.set(directoryId, directory);
    parent.children.push(directory);
    return directory;
}

function finalizeTree(nodes: VaultPageTreeNode[]): VaultPageTreeNode[] {
    return nodes
        .map((node) => {
            if (node.kind === 'file') {
                return node;
            }
            return {
                children: finalizeTree(node.children),
                id: node.id,
                kind: node.kind,
                name: node.name,
            };
        })
        .sort(compareTreeNodes);
}

function compareTreeNodes(left: VaultPageTreeNode, right: VaultPageTreeNode) {
    if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
}

function splitTreePath(value: string) {
    return value.split('/').filter(Boolean);
}

function removeMarkdownExtension(value: string) {
    return value.replace(/\.md$/u, '');
}
