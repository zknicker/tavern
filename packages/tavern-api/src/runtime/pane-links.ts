import type { ChatPaneTarget } from './contracts.js';

// The tavern:// link scheme for chat pane targets. This is the one shared
// parser for every consumer of the scheme — app link clicks and the Runtime
// pane_open agent tool must agree on what a link means and what is unsafe.
const tavernProtocol = 'tavern:';

export function parseChatPaneTargetLink(href: string): ChatPaneTarget | null {
    let url: URL;

    if (/[\\/]\.{1,2}(?:[\\/]|$)/u.test(href)) {
        return null;
    }

    try {
        url = new URL(href);
    } catch {
        return null;
    }

    if (url.protocol !== tavernProtocol || url.search || url.hash) {
        return null;
    }

    const path = parseTargetPath(url.pathname);
    if (path === null) {
        return null;
    }

    switch (url.hostname) {
        case 'wiki':
            return path ? { kind: 'wikiPage', path } : { kind: 'wikiDirectory', path: '' };
        case 'workspace':
            return path
                ? { kind: 'workspaceFile', path }
                : { kind: 'workspaceDirectory', path: '' };
        default:
            return null;
    }
}

export function formatChatPaneTargetLink(target: ChatPaneTarget) {
    const host =
        target.kind === 'wikiPage' || target.kind === 'wikiDirectory' ? 'wiki' : 'workspace';
    const path = target.path
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');

    return `tavern://${host}/${path}`;
}

function parseTargetPath(pathname: string) {
    if (!pathname.startsWith('/') || pathname.startsWith('//')) {
        return null;
    }

    let path: string;

    try {
        path = decodeURIComponent(pathname.slice(1));
    } catch {
        return null;
    }

    if (
        path.startsWith('/') ||
        path.startsWith('\\') ||
        (path.length > 0 &&
            path.split('/').some((segment) => segment === '..' || segment.length === 0))
    ) {
        return null;
    }

    return path;
}
