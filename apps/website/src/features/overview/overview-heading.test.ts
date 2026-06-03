import { describe, expect, test } from 'bun:test';
import {
    buildOverviewHeading,
    overviewHeadingPhrases,
    overviewIdleHourPhrases,
} from './overview-heading.ts';

const idleState = {
    jobs: [],
    memoryCount: 0,
    sessionsCount: 0,
    workers: [],
};

describe('buildOverviewHeading', () => {
    test('reflects the exact hour for an idle tavern', () => {
        expect(overviewIdleHourPhrases[9]).toContain(
            buildOverviewHeading({
                ...idleState,
                now: new Date('2026-06-03T09:00:00'),
            })
        );

        expect(overviewIdleHourPhrases[12]).toContain(
            buildOverviewHeading({
                ...idleState,
                now: new Date('2026-06-03T12:00:00'),
            })
        );

        expect(overviewIdleHourPhrases[22]).toContain(
            buildOverviewHeading({
                ...idleState,
                now: new Date('2026-06-03T22:00:00'),
            })
        );
    });

    test('uses completed quest copy for succeeded workers', () => {
        expect(overviewHeadingPhrases.completedQuests).toContain(
            buildOverviewHeading({
                ...idleState,
                now: new Date('2026-06-03T18:00:00'),
                workers: [{ status: 'succeeded' }],
            })
        );
    });

    test('uses cron and warning copy for ambient state', () => {
        expect(overviewHeadingPhrases.cronJobs).toContain(
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

    test('uses arrival and chronicle copy for existing state', () => {
        expect(overviewHeadingPhrases.newSessions).toContain(
            buildOverviewHeading({
                ...idleState,
                now: new Date('2026-06-03T19:00:00'),
                sessionsCount: 2,
            })
        );

        expect(overviewHeadingPhrases.memoryStored).toContain(
            buildOverviewHeading({
                ...idleState,
                memoryCount: 1,
                now: new Date('2026-06-03T07:00:00'),
            })
        );
    });

    test('keeps the phrase pool short and varied', () => {
        const phrases = [
            ...Object.values(overviewHeadingPhrases).flat(),
            ...overviewIdleHourPhrases.flat(),
        ];

        expect(overviewIdleHourPhrases).toHaveLength(24);
        for (const hourPhrases of overviewIdleHourPhrases) {
            expect(hourPhrases).toHaveLength(3);
        }

        expect(phrases).toHaveLength(102);
        expect(new Set(phrases).size).toBe(102);

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
