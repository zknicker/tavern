import { describe, expect, test } from 'bun:test';
import {
    buildOverviewGreeting,
    buildOverviewHeading,
    overviewIdleHourPhrases,
} from './overview-heading.ts';

function containsPhrase(phrases: readonly string[], phrase: string) {
    return phrases.includes(phrase);
}

describe('buildOverviewHeading', () => {
    test('reflects the exact hour for an idle tavern', () => {
        expect(
            containsPhrase(
                overviewIdleHourPhrases[9],
                buildOverviewHeading({
                    now: new Date('2026-06-03T09:00:00'),
                })
            )
        ).toBe(true);

        expect(
            containsPhrase(
                overviewIdleHourPhrases[12],
                buildOverviewHeading({
                    now: new Date('2026-06-03T12:00:00'),
                })
            )
        ).toBe(true);

        expect(
            containsPhrase(
                overviewIdleHourPhrases[22],
                buildOverviewHeading({
                    now: new Date('2026-06-03T22:00:00'),
                })
            )
        ).toBe(true);
    });

    test('uses hourly copy even when activity exists', () => {
        expect(
            containsPhrase(
                overviewIdleHourPhrases[18],
                buildOverviewHeading({
                    now: new Date('2026-06-03T18:00:00'),
                })
            )
        ).toBe(true);
    });

    test('keeps the phrase pool short and varied', () => {
        const phrases = overviewIdleHourPhrases.flat();

        expect(overviewIdleHourPhrases).toHaveLength(24);
        for (const hourPhrases of overviewIdleHourPhrases) {
            expect(hourPhrases).toHaveLength(3);
        }

        expect(phrases).toHaveLength(72);
        expect(new Set(phrases).size).toBe(72);

        for (const phrase of phrases) {
            const wordCount = phrase
                .replace(/[.,;!]/g, '')
                .split(/\s+/u)
                .filter(Boolean).length;
            expect(phrase).not.toMatch(/[—–-]|--/u);
            expect(wordCount).toBeGreaterThanOrEqual(4);
            expect(wordCount).toBeLessThanOrEqual(8);
        }
    });
});

describe('buildOverviewGreeting', () => {
    test('matches the time of day', () => {
        expect(buildOverviewGreeting({ now: new Date('2026-06-03T09:00:00') })).toEqual({
            lead: 'Good',
            accent: 'morning',
            name: null,
        });
        expect(buildOverviewGreeting({ now: new Date('2026-06-03T14:00:00') })).toEqual({
            lead: 'Good',
            accent: 'afternoon',
            name: null,
        });
        expect(buildOverviewGreeting({ now: new Date('2026-06-03T19:00:00') })).toEqual({
            lead: 'Good',
            accent: 'evening',
            name: null,
        });
        expect(buildOverviewGreeting({ now: new Date('2026-06-03T23:30:00') })).toEqual({
            lead: 'Up',
            accent: 'late',
            name: null,
        });
        expect(buildOverviewGreeting({ now: new Date('2026-06-03T02:00:00') })).toEqual({
            lead: 'Up',
            accent: 'late',
            name: null,
        });
    });

    test('greets by first name only', () => {
        expect(
            buildOverviewGreeting({
                name: 'Zach Knickerbocker',
                now: new Date('2026-06-03T09:00:00'),
            })
        ).toEqual({ lead: 'Good', accent: 'morning', name: 'Zach' });
    });

    test('ignores blank names', () => {
        expect(
            buildOverviewGreeting({ name: '   ', now: new Date('2026-06-03T09:00:00') })
        ).toEqual({ lead: 'Good', accent: 'morning', name: null });
    });
});
