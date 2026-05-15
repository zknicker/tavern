import { normalizeToolMentions } from './tool-mention-text.ts';
import type { ToolMention } from './tool-mention-types.ts';

export function readToolMentionsFromMetadata(
    content: string,
    metadata: Record<string, unknown> | null | undefined
) {
    const tavern = readRecord(metadata?.tavern);
    const rawMentions = Array.isArray(tavern?.toolMentions) ? tavern.toolMentions : [];

    return normalizeToolMentions(content, rawMentions.flatMap(readToolMention));
}

function readToolMention(value: unknown): ToolMention[] {
    const record = readRecord(value);

    if (!record) {
        return [];
    }

    const kind = record.kind;
    const id = record.id;
    const label = record.label;
    const text = record.text;
    const start = record.start;
    const end = record.end;

    if (
        !(kind === 'app' || kind === 'skill' || kind === 'tool') ||
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
            start,
            text,
        },
    ];
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
