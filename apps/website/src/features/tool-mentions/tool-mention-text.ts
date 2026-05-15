import type {
    ActiveToolMentionQuery,
    ToolMention,
    ToolMentionOption,
} from './tool-mention-types.ts';

export function getActiveToolMentionQuery(
    content: string,
    caretIndex: number | null
): ActiveToolMentionQuery | null {
    if (caretIndex === null || caretIndex < 1 || caretIndex > content.length) {
        return null;
    }

    const beforeCaret = content.slice(0, caretIndex);
    const match = /(?:^|\s)@([^\s@]*)$/u.exec(beforeCaret);

    if (!match || match.index === undefined) {
        return null;
    }

    const start = match.index + (match[0].startsWith('@') ? 0 : 1);

    return {
        end: caretIndex,
        query: match[1] ?? '',
        start,
    };
}

export function reconcileToolMentions(
    previousContent: string,
    nextContent: string,
    mentions: readonly ToolMention[]
) {
    const change = getTextChange(previousContent, nextContent);

    return normalizeToolMentions(
        nextContent,
        mentions.flatMap((mention) => {
            if (change.start >= mention.end) {
                return [mention];
            }

            if (change.previousEnd <= mention.start) {
                return [
                    {
                        ...mention,
                        end: mention.end + change.delta,
                        start: mention.start + change.delta,
                    },
                ];
            }

            return [];
        })
    );
}

export function normalizeToolMentions(content: string, mentions: readonly ToolMention[]) {
    const sorted = [...mentions].sort((a, b) => a.start - b.start || a.end - b.end);
    const normalized: ToolMention[] = [];
    let previousEnd = 0;

    for (const mention of sorted) {
        if (
            mention.start < previousEnd ||
            mention.start < 0 ||
            mention.end > content.length ||
            mention.end <= mention.start ||
            content.slice(mention.start, mention.end) !== mention.text
        ) {
            continue;
        }

        normalized.push(mention);
        previousEnd = mention.end;
    }

    return normalized;
}

export function buildToolMentionMetadata(mentions: readonly ToolMention[]) {
    const normalized = mentions.filter((mention) => mention.id.trim().length > 0);

    return normalized.length > 0
        ? {
              tavern: {
                  toolMentions: normalized,
              },
          }
        : undefined;
}

export function selectToolMention(input: {
    activeQuery: ActiveToolMentionQuery;
    content: string;
    mentions: readonly ToolMention[];
    option: ToolMentionOption;
}) {
    const { activeQuery, content, mentions, option } = input;
    const before = content.slice(0, activeQuery.start);
    const after = content.slice(activeQuery.end);
    const nextContent = `${before}${option.label}${after}`;
    const mention: ToolMention = {
        end: activeQuery.start + option.label.length,
        id: option.id,
        kind: option.kind,
        label: option.label,
        start: activeQuery.start,
        text: option.label,
    };
    const delta = option.label.length - (activeQuery.end - activeQuery.start);
    const nextMentions = normalizeToolMentions(nextContent, [
        ...mentions.flatMap((entry) => {
            if (entry.end <= activeQuery.start) {
                return [entry];
            }

            if (entry.start >= activeQuery.end) {
                return [
                    {
                        ...entry,
                        end: entry.end + delta,
                        start: entry.start + delta,
                    },
                ];
            }

            return [];
        }),
        mention,
    ]);

    return {
        nextCaretIndex: mention.end,
        nextContent,
        nextMentions,
    };
}

function getTextChange(previousContent: string, nextContent: string) {
    let start = 0;

    while (
        start < previousContent.length &&
        start < nextContent.length &&
        previousContent[start] === nextContent[start]
    ) {
        start += 1;
    }

    let previousEnd = previousContent.length;
    let nextEnd = nextContent.length;

    while (
        previousEnd > start &&
        nextEnd > start &&
        previousContent[previousEnd - 1] === nextContent[nextEnd - 1]
    ) {
        previousEnd -= 1;
        nextEnd -= 1;
    }

    return {
        delta: nextEnd - previousEnd,
        previousEnd,
        start,
    };
}
