import { describe, expect, it } from 'bun:test';
import {
    getActiveToolMentionQuery,
    normalizeToolMentions,
    reconcileToolMentions,
    selectToolMention,
} from './tool-mention-text.ts';

describe('tool mention text helpers', () => {
    it('finds the active @ query before the caret', () => {
        expect(getActiveToolMentionQuery('use @Chr', 8)).toEqual({
            end: 8,
            query: 'Chr',
            start: 4,
        });
    });

    it('keeps mention offsets aligned when text changes before the mention', () => {
        const mentions = [
            {
                end: 10,
                id: 'chrome',
                kind: 'skill' as const,
                label: 'Chrome',
                start: 4,
                text: 'Chrome',
            },
        ];

        expect(reconcileToolMentions('use Chrome', 'please use Chrome', mentions)).toEqual([
            {
                ...mentions[0],
                end: 17,
                start: 11,
            },
        ]);
    });

    it('drops mentions when their text no longer matches', () => {
        expect(
            normalizeToolMentions('use Chrom', [
                {
                    end: 10,
                    id: 'chrome',
                    kind: 'skill',
                    label: 'Chrome',
                    start: 4,
                    text: 'Chrome',
                },
            ])
        ).toEqual([]);
    });

    it('keeps later mention offsets aligned when selecting a new earlier mention', () => {
        expect(
            selectToolMention({
                activeQuery: {
                    end: 9,
                    query: 'Git',
                    start: 4,
                },
                content: 'use @Git then Chrome',
                mentions: [
                    {
                        end: 20,
                        id: 'chrome',
                        kind: 'skill',
                        label: 'Chrome',
                        start: 14,
                        text: 'Chrome',
                    },
                ],
                option: {
                    id: 'github',
                    kind: 'app',
                    label: 'GitHub',
                },
            }).nextMentions
        ).toEqual([
            {
                end: 10,
                id: 'github',
                kind: 'app',
                label: 'GitHub',
                start: 4,
                text: 'GitHub',
            },
            {
                end: 21,
                id: 'chrome',
                kind: 'skill',
                label: 'Chrome',
                start: 15,
                text: 'Chrome',
            },
        ]);
    });
});
