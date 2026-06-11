import type { CortexListOutput } from '../../lib/trpc.tsx';
import type { CortexPageNode } from './types.ts';

export type CortexPageTreeNode = CortexPageTreeDirectory | CortexPageTreeFile;

export interface CortexPageTreeDirectory {
    children: CortexPageTreeNode[];
    id: string;
    kind: 'directory';
    name: string;
}

export interface CortexPageTreeFile {
    id: string;
    kind: 'file';
    name: string;
    page: CortexPageNode;
}

export function filterPages(pages: CortexPageNode[], query: string) {
    const terms = query.trim().toLowerCase();
    if (!terms) {
        return pages;
    }

    return pages.filter((page) =>
        [page.title, page.topic, page.path, page.section].join(' ').toLowerCase().includes(terms)
    );
}

export function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function resolveSelectedPage(
    list: CortexListOutput,
    selected: { path: string; topic: string } | null
) {
    if (selected) {
        const exact = list.pages.find(
            (page) => page.path === selected.path && page.topic === selected.topic
        );
        if (exact) {
            return exact;
        }
    }
    return list.pages[0] ?? null;
}

export function pageKey(page: Pick<CortexPageNode, 'path' | 'topic'>) {
    return `${page.topic}:${page.path}`;
}

/**
 * Resolves a wiki link target — a `[[wikilink]]` slug or a relative `.md`
 * path — to a known page. Same-topic matches win; cross-topic slug matches
 * are the fallback so dual-links keep working across topic wikis.
 */
export function resolveCortexLinkTarget(
    pages: CortexPageNode[],
    currentPage: { path: string; topic: string },
    target: string
): CortexPageNode | null {
    if (target.includes('/')) {
        const resolvedPath = resolveRelativePagePath(currentPage.path, target);
        const byPath = pages.find(
            (page) => page.topic === currentPage.topic && page.path === resolvedPath
        );
        if (byPath) {
            return byPath;
        }
    }

    const slug = pageSlug(target);
    return (
        pages.find((page) => page.topic === currentPage.topic && pageSlug(page.path) === slug) ??
        pages.find((page) => pageSlug(page.path) === slug) ??
        null
    );
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

export function buildCortexPageTree(
    pages: CortexPageNode[],
    options: { includeTopicRoot: boolean }
): CortexPageTreeNode[] {
    const root = createInternalDirectory('', '');

    for (const page of pages) {
        const segments = getPageTreeSegments(page, options.includeTopicRoot);
        const fileName = segments.at(-1) ?? page.title;
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

export function getCortexDirectoryIds(nodes: CortexPageTreeNode[]) {
    return nodes.flatMap((node): string[] => {
        if (node.kind === 'file') {
            return [];
        }
        return [node.id, ...getCortexDirectoryIds(node.children)];
    });
}

interface InternalDirectory {
    children: CortexPageTreeNode[];
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

function finalizeTree(nodes: CortexPageTreeNode[]): CortexPageTreeNode[] {
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

function compareTreeNodes(left: CortexPageTreeNode, right: CortexPageTreeNode) {
    if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
}

function getPageTreeSegments(page: CortexPageNode, includeTopicRoot: boolean) {
    const pathSegments = splitTreePath(page.path);
    if (!includeTopicRoot) {
        return pathSegments;
    }
    return [...splitTreePath(page.topic), ...pathSegments];
}

function splitTreePath(value: string) {
    return value.split('/').filter(Boolean);
}
