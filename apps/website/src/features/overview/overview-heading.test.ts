import { describe, expect, test } from 'bun:test';
import { buildOverviewHeading, overviewHeadingPhrases } from './overview-heading.ts';

const idleState = {
    jobs: [],
    memoryCount: 0,
    sessionsCount: 0,
    workers: [],
};

describe('buildOverviewHeading', () => {
    test('reflects time of day for an idle tavern', () => {
        expect(overviewHeadingPhrases.morning).toContain(
            buildOverviewHeading({
                ...idleState,
                now: new Date('2026-06-03T09:00:00'),
            })
        );

        expect(overviewHeadingPhrases.deepNight).toContain(
            buildOverviewHeading({
                ...idleState,
                now: new Date('2026-06-03T22:00:00'),
            })
        );
    });

    test('prioritizes live worker state over quiet state', () => {
        expect(overviewHeadingPhrases.activeMany).toContain(
            buildOverviewHeading({
                ...idleState,
                now: new Date('2026-06-03T18:00:00'),
                workers: [{ status: 'running' }, { status: 'waiting' }],
            })
        );
    });

    test('uses scheduled and stale work as ambient state', () => {
        expect(overviewHeadingPhrases.scheduled).toContain(
            buildOverviewHeading({
                ...idleState,
                jobs: [
                    {
                        enabled: true,
                        state: {},
                    },
                ],
                now: new Date('2026-06-03T14:00:00'),
            })
        );

        expect(overviewHeadingPhrases.attention).toContain(
            buildOverviewHeading({
                ...idleState,
                jobs: [
                    {
                        enabled: true,
                        state: {
                            lastRunStatus: 'error',
                        },
                    },
                ],
                now: new Date('2026-06-03T02:00:00'),
            })
        );
    });

    test('keeps the phrase pool short and varied', () => {
        const phrases = Object.values(overviewHeadingPhrases).flat();

        expect(phrases).toHaveLength(30);
        expect(new Set(phrases).size).toBe(30);

        for (const phrase of phrases) {
            const wordCount = phrase
                .replace(/[.,;!]/g, '')
                .split(/\s+/u)
                .filter(Boolean).length;
            expect(phrase).not.toMatch(/[;—–-]|--/u);
            expect(wordCount).toBeGreaterThanOrEqual(5);
            expect(wordCount).toBeLessThanOrEqual(6);
        }
    });
});
