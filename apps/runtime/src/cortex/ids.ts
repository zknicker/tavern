import { createHash, randomUUID } from 'node:crypto';

const slugMaxLength = 96;

export function createCortexId(prefix: string): string {
    return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

export function hashText(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

export function slugifyCortexTitle(title: string): string {
    const slug = title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9/]+/gu, '-')
        .replace(/\/+/gu, '/')
        .replace(/^-+|-+$/gu, '')
        .replace(/\/-/gu, '/')
        .replace(/-\//gu, '/')
        .slice(0, slugMaxLength)
        .replace(/^-+|-+$/gu, '');

    return slug || 'note';
}
