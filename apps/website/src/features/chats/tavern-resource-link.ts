export type TavernResourceTarget =
    | { kind: 'vaultDirectory'; path: string }
    | { kind: 'vaultPage'; path: string }
    | { kind: 'workspaceDirectory'; path: string }
    | { kind: 'workspaceFile'; path: string }
    | { kind: 'workspaceRoot'; path: '' };

const tavernProtocol = 'tavern:';

export function parseTavernResourceLink(href: string): TavernResourceTarget | null {
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

    const path = parseResourcePath(url.pathname);
    if (path === null) {
        return null;
    }

    switch (url.hostname) {
        case 'vault':
            return path ? { kind: 'vaultPage', path } : { kind: 'vaultDirectory', path: '' };
        case 'workspace':
            return path
                ? { kind: 'workspaceFile', path }
                : { kind: 'workspaceDirectory', path: '' };
        default:
            return null;
    }
}

export function getArtifactPanelTargetKey(target: TavernResourceTarget) {
    return `${target.kind}:${target.path}`;
}

export function getArtifactPanelTargetLabel(target: TavernResourceTarget) {
    if (target.kind === 'vaultDirectory') {
        return target.path ? (target.path.split('/').filter(Boolean).at(-1) ?? 'Vault') : 'Vault';
    }

    if (target.kind === 'workspaceDirectory') {
        return target.path
            ? (target.path.split('/').filter(Boolean).at(-1) ?? 'Workspace')
            : 'Workspace';
    }

    if (target.kind === 'workspaceRoot') {
        return 'Workspace';
    }

    const label = target.path.split('/').filter(Boolean).at(-1);
    return label && label.length > 0 ? label : target.path;
}

export function formatTavernResourceLink(target: TavernResourceTarget) {
    const host =
        target.kind === 'vaultPage' || target.kind === 'vaultDirectory' ? 'vault' : 'workspace';
    const path = target.path
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');

    return `tavern://${host}/${path}`;
}

function parseResourcePath(pathname: string) {
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
