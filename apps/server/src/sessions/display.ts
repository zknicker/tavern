import { z } from 'zod';

export const sessionTypeSchema = z.enum(['chat', 'cron', 'link', 'portal']);

export type SessionType = z.infer<typeof sessionTypeSchema>;

const cronPrefixPattern = /^Cron:\s*/u;
const linkPrefixPattern = /^link:\s*/u;

function hasSessionValue(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

export function getSessionSource(input: {
    source?: string | null;
    key: string;
    title?: string | null;
}) {
    const title = input.title?.trim();

    if (hasSessionValue(title)) {
        return title;
    }

    const source = input.source?.trim();

    if (hasSessionValue(source)) {
        return source;
    }

    return input.key;
}

export function getSessionType(input: {
    source?: string | null;
    key: string;
    title?: string | null;
}): SessionType {
    const source = getSessionSource(input);

    if (
        source.startsWith('Cron:') ||
        input.key.includes(':cron:') ||
        input.key.includes(':reminder:')
    ) {
        return 'cron';
    }

    if (source.startsWith('link:') || input.key.includes(':link:')) {
        return 'link';
    }

    if (source.startsWith('portal:') || input.key.includes(':portal:')) {
        return 'portal';
    }

    return 'chat';
}

export function getSessionName(input: {
    source?: string | null;
    key: string;
    title?: string | null;
}) {
    const source = getSessionSource(input);
    const type = getSessionType(input);

    if (type === 'cron') {
        return source.replace(cronPrefixPattern, '').trim() || source;
    }

    if (type === 'link') {
        return source.replace(linkPrefixPattern, '').trim() || source;
    }

    if (type === 'portal') {
        return source;
    }

    return source;
}

export function getSessionDisplay(input: {
    source?: string | null;
    key: string;
    title?: string | null;
}) {
    return {
        name: getSessionName(input),
        source: getSessionSource(input),
        type: getSessionType(input),
    };
}
