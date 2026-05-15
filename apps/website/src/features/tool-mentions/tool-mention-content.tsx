import * as React from 'react';
import { ToolMentionBadge } from './tool-mention-badge.tsx';
import { normalizeToolMentions } from './tool-mention-text.ts';
import type { ToolMention } from './tool-mention-types.ts';

export function ToolMentionContent({
    content,
    mentionClassName,
    mentionVariant,
    mentions,
}: {
    content: string;
    mentionClassName?: string;
    mentionVariant?: 'badge' | 'text';
    mentions: readonly ToolMention[];
}) {
    const fragments = React.useMemo(
        () => splitToolMentionContent(content, mentions),
        [content, mentions]
    );

    return (
        <>
            {fragments.map((fragment) =>
                fragment.type === 'mention' ? (
                    <ToolMentionBadge
                        className={mentionClassName}
                        id={fragment.mention.id}
                        key={`${fragment.mention.start}:${fragment.mention.end}`}
                        kind={fragment.mention.kind}
                        label={fragment.mention.label}
                        variant={mentionVariant}
                    />
                ) : (
                    <React.Fragment key={`${fragment.start}:${fragment.text}`}>
                        {fragment.text}
                    </React.Fragment>
                )
            )}
        </>
    );
}

function splitToolMentionContent(content: string, mentions: readonly ToolMention[]) {
    const normalized = normalizeToolMentions(content, mentions);
    const fragments: Array<
        { start: number; text: string; type: 'text' } | { mention: ToolMention; type: 'mention' }
    > = [];
    let cursor = 0;

    for (const mention of normalized) {
        if (mention.start > cursor) {
            fragments.push({
                start: cursor,
                text: content.slice(cursor, mention.start),
                type: 'text',
            });
        }

        fragments.push({ mention, type: 'mention' });
        cursor = mention.end;
    }

    if (cursor < content.length || fragments.length === 0) {
        fragments.push({
            start: cursor,
            text: content.slice(cursor),
            type: 'text',
        });
    }

    return fragments;
}
