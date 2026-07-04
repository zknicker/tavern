import { parseTavernRichReferences } from '@tavern/api/rich-references';
import { normalizeMentions } from './mention-text.ts';
import type { Mention } from './mention-types.ts';

export function readMentionsFromMarkdown(content: string) {
    return normalizeMentions(
        content,
        parseTavernRichReferences(content).map((reference) => ({
            ...reference,
            kind: reference.kind as Mention['kind'],
        }))
    );
}
