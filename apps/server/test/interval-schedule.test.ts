import { describe, expect, it } from 'bun:test';
import { getStalePendingRunIds, hasRecentIntervalRun } from '../src/jobs/interval-schedule.ts';

describe('getStalePendingRunIds', () => {
    it('keeps the newest pending interval run and prunes older ones', () => {
        expect(
            getStalePendingRunIds([
                {
                    id: 'older',
                    timestamp: 100,
                },
                {
                    id: 'newest',
                    timestamp: 300,
                },
                {
                    id: 'middle',
                    timestamp: 200,
                },
            ])
        ).toEqual(['middle', 'older']);
    });
});

describe('hasRecentIntervalRun', () => {
    it('suppresses another immediate enqueue when a recent run already exists', () => {
        expect(
            hasRecentIntervalRun(
                [
                    {
                        finishedOn: 9000,
                        timestamp: 8000,
                    },
                ],
                {
                    intervalMs: 5000,
                    nowMs: 10_000,
                }
            )
        ).toBe(true);
    });

    it('allows an immediate enqueue when the latest run is stale', () => {
        expect(
            hasRecentIntervalRun(
                [
                    {
                        finishedOn: 4000,
                        timestamp: 3000,
                    },
                ],
                {
                    intervalMs: 5000,
                    nowMs: 10_000,
                }
            )
        ).toBe(false);
    });
});
