import { describe, expect, it } from 'vitest';
import { nextFireAtMs } from './reminder-cadence.ts';

describe('DST-safe reminder cadence', () => {
    const dailyAtNine = { hour: 9, kind: 'daily' as const, minute: 0 };

    it('shifts a nonexistent spring-forward time after the jump', () => {
        const after = Date.UTC(2026, 2, 8, 4, 30); // Mar 7 23:30 EST.

        expect(
            nextFireAtMs({ hour: 2, kind: 'daily', minute: 30 }, after, 'America/New_York')
        ).toBe(Date.UTC(2026, 2, 8, 7, 30)); // Mar 8 03:30 EDT.
    });

    it('keeps 09:00 local across the spring-forward boundary', () => {
        const after = Date.UTC(2026, 2, 8, 4, 30); // Mar 7 23:30 EST.

        expect(nextFireAtMs(dailyAtNine, after, 'America/New_York')).toBe(
            Date.UTC(2026, 2, 8, 13, 0)
        );
    });

    it('fires once on the fall-back date', () => {
        const after = Date.UTC(2026, 10, 1, 3, 30); // Oct 31 23:30 EDT.
        const dailyAtOneThirty = { hour: 1, kind: 'daily' as const, minute: 30 };
        const first = nextFireAtMs(dailyAtOneThirty, after, 'America/New_York');

        expect(first).toBe(Date.UTC(2026, 10, 1, 5, 30));
        expect(nextFireAtMs(dailyAtOneThirty, first, 'America/New_York')).toBe(
            Date.UTC(2026, 10, 2, 6, 30)
        );
    });
});
