import { getTavernRuntimeOrigin } from '../../lib/agent-runtime.ts';
import { getClerkSessionToken } from '../../lib/clerk.tsx';

const inertWikiImagePreviewUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export function resolveWikiAttachmentPath(pagePath: string, source: string) {
    if (/^[a-z][a-z0-9+.-]*:/iu.test(source) || source.startsWith('/')) {
        return null;
    }
    let sourceSegments: string[];
    try {
        sourceSegments = source.split('/').map((segment) => decodeURIComponent(segment));
    } catch {
        return null;
    }
    const segments = [...pagePath.split('/').slice(0, -1), ...sourceSegments];
    const resolved: string[] = [];
    for (const segment of segments) {
        if (!segment || segment === '.') {
            continue;
        }
        if (segment === '..') {
            resolved.pop();
            continue;
        }
        resolved.push(segment);
    }
    return resolved.includes('_attachments') ? resolved.join('/') : null;
}

export function wikiAttachmentRequestUrl(pagePath: string, source: string) {
    const attachmentPath = resolveWikiAttachmentPath(pagePath, source);
    if (!attachmentPath) {
        return null;
    }
    const route = `/wiki/attachments/${attachmentPath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}`;
    if (typeof window === 'undefined') {
        return route;
    }
    return new URL(route, getTavernRuntimeOrigin()).toString();
}

export async function loadWikiAttachmentPreview(pagePath: string, source: string) {
    const url = wikiAttachmentRequestUrl(pagePath, source);
    if (!url) {
        return inertWikiImagePreviewUrl;
    }
    const token = await getClerkSessionToken();
    const response = await fetch(url, {
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
        throw new Error('Unable to load this Wiki image.');
    }
    return await blobToDataUrl(await response.blob());
}

async function blobToDataUrl(blob: Blob) {
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read this Wiki image.'));
        reader.onload = () =>
            typeof reader.result === 'string'
                ? resolve(reader.result)
                : reject(new Error('Unable to encode this Wiki image.'));
        reader.readAsDataURL(blob);
    });
}
