import { describe, expect, it } from 'bun:test';
import {
    filterMentionOptionsForQuery,
    selectMentionOptionsForQuery,
} from './use-mention-options.ts';
import type { MentionOption } from './mention-types.ts';

describe('filterMentionOptionsForQuery', () => {
    it('does not render stale broad mention results for a narrower app query', () => {
        const options: MentionOption[] = [
            {
                description: 'Computer use',
                id: 'plugin://computer-use@openai-bundled',
                insertText: 'Computer Use',
                kind: 'app',
                label: 'Computer Use',
                projection: 'capability-reference',
                sourceLabel: 'Mac app',
            },
            {
                description: 'Computer use',
                id: 'plugin://computer-use@openai-bundled',
                insertText: 'Helium',
                kind: 'app',
                label: 'Helium',
                projection: 'capability-reference',
                sourceLabel: 'Mac app',
            },
        ];

        expect(filterMentionOptionsForQuery(options, 'Helium')).toEqual([options[1]]);
    });

    it('filters mention options without matching query case', () => {
        const options: MentionOption[] = [
            {
                description: 'Running in Computer Use',
                id: 'plugin://computer-use@openai-bundled',
                insertText: 'Helium',
                kind: 'app',
                label: 'Helium',
                projection: 'capability-reference',
                sourceLabel: 'Mac app',
            },
        ];

        expect(filterMentionOptionsForQuery(options, 'Hel')).toEqual(options);
        expect(filterMentionOptionsForQuery(options, 'hel')).toEqual(options);
    });
});

describe('selectMentionOptionsForQuery', () => {
    it('filters warmed inventory options locally', () => {
        const helium = createOption({ label: 'Helium' });
        const chrome = createOption({ label: 'Chrome' });

        expect(
            selectMentionOptionsForQuery({
                inventoryData: {
                    options: [helium, chrome],
                },
                query: 'Hel',
                pathData: undefined,
            })
        ).toEqual([helium]);
    });

    it('merges path search results with filtered inventory', () => {
        const helium = createOption({ label: 'Helium' });
        const pathOption: MentionOption = {
            description: 'specs',
            id: '/repo/specs/helium.md',
            insertText: 'specs/helium.md',
            kind: 'file',
            label: 'specs/helium.md',
            projection: 'path-reference',
            sourceLabel: 'File',
        };

        expect(
            selectMentionOptionsForQuery({
                inventoryData: {
                    options: [helium],
                },
                query: 'Hel',
                pathData: {
                    options: [pathOption],
                    query: 'Hel',
                },
            })
        ).toEqual([helium, pathOption]);
    });
});

function createOption(input: { label: string }): MentionOption {
    return {
        description: 'Computer Use',
        id: 'plugin://computer-use@openai-bundled',
        insertText: input.label,
        kind: 'app',
        label: input.label,
        projection: 'capability-reference',
        sourceLabel: 'Mac app',
    };
}
