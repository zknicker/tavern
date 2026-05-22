import { normalizeMentions } from './mention-text.ts';
import type { Mention } from './mention-types.ts';

export function readMentionsFromMetadata(
    content: string,
    metadata: Record<string, unknown> | null | undefined
) {
    const tavern = readRecord(metadata?.tavern);
    const rawMentions = Array.isArray(tavern?.mentions) ? tavern.mentions : [];
    const mentions = normalizeMentions(content, rawMentions.flatMap(readMention));

    return mentions.length > 0 ? mentions : readMentionsFromMarkdown(content);
}

function readMention(value: unknown): Mention[] {
    const record = readRecord(value);

    if (!record) {
        return [];
    }

    const kind = normalizeKind(record.kind);
    const id = record.id;
    const label = record.label;
    const projection = readProjection(record.projection, kind);
    const text = record.text;
    const start = record.start;
    const end = record.end;

    if (
        kind === null ||
        projection === null ||
        typeof id !== 'string' ||
        typeof label !== 'string' ||
        typeof text !== 'string' ||
        typeof start !== 'number' ||
        typeof end !== 'number' ||
        !Number.isInteger(start) ||
        !Number.isInteger(end)
    ) {
        return [];
    }

    return [
        {
            end,
            id,
            kind,
            label,
            metadata: readMentionMetadata(record.metadata),
            projection,
            start,
            text,
        },
    ];
}

function readMentionsFromMarkdown(content: string) {
    const mentions: Mention[] = [];
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/gu;

    for (const match of content.matchAll(linkPattern)) {
        const text = match[0];
        const rawLabel = match[1];
        const target = match[2];
        const start = match.index;

        if (
            typeof text !== 'string' ||
            typeof rawLabel !== 'string' ||
            typeof target !== 'string' ||
            start === undefined
        ) {
            continue;
        }

        const inferred = inferMentionFromMarkdown({ rawLabel, target });

        if (!inferred) {
            continue;
        }

        mentions.push({
            ...inferred,
            end: start + text.length,
            id: target,
            start,
            text,
        });
    }

    return normalizeMentions(content, mentions);
}

function inferMentionFromMarkdown({
    rawLabel,
    target,
}: {
    rawLabel: string;
    target: string;
}): Pick<Mention, 'kind' | 'label' | 'projection'> | null {
    if (target.startsWith('plugin://')) {
        return {
            kind: 'plugin',
            label: stripMentionPrefix(rawLabel),
            projection: 'capability-reference',
        };
    }

    if (target.startsWith('app://')) {
        return {
            kind: 'app',
            label: stripMentionPrefix(rawLabel),
            projection: 'capability-reference',
        };
    }

    if (target.startsWith('/')) {
        if (rawLabel.startsWith('$') || target.endsWith('/SKILL.md')) {
            return {
                kind: 'skill',
                label: stripMentionPrefix(rawLabel),
                projection: 'skill-context',
            };
        }

        const kind = inferPathKind(rawLabel, target);

        return {
            kind,
            label: stripMentionPrefix(rawLabel),
            projection: 'path-reference',
        };
    }

    return null;
}

function stripMentionPrefix(label: string) {
    return label.replace(/^[@$]/u, '');
}

function inferPathKind(
    label: string,
    target: string
): Extract<Mention['kind'], 'directory' | 'file'> {
    if (label.includes('/')) {
        return 'directory';
    }

    const finalSegment = target.split('/').filter(Boolean).at(-1) ?? '';

    return /\.[A-Za-z0-9]+$/u.test(finalSegment) ? 'file' : 'directory';
}

function normalizeKind(value: unknown): Mention['kind'] | null {
    if (value === 'tool') {
        return 'plugin';
    }

    if (
        value === 'app' ||
        value === 'directory' ||
        value === 'file' ||
        value === 'image' ||
        value === 'plugin' ||
        value === 'skill'
    ) {
        return value;
    }

    return null;
}

function readProjection(value: unknown, kind: unknown): Mention['projection'] | null {
    if (
        value === 'capability-reference' ||
        value === 'image-input' ||
        value === 'path-reference' ||
        value === 'skill-context'
    ) {
        return value;
    }

    if (kind === 'skill') {
        return 'skill-context';
    }

    if (kind === 'app' || kind === 'plugin' || kind === 'tool') {
        return 'capability-reference';
    }

    if (kind === 'file' || kind === 'directory') {
        return 'path-reference';
    }

    if (kind === 'image') {
        return 'image-input';
    }

    return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function readMentionMetadata(value: unknown) {
    return readRecord(value) ?? undefined;
}
