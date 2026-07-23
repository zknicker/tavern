import { describe, expect, it } from 'vitest';
import { nextFireAtMs } from './reminder-cadence.ts';

describe('DST-safe reminder cadence', () => {
    const dailyAtNine = { hour: 9, kind: 'daily' as const, minute: 0 };

    it('keeps 09:00 local across the spring-forward boundary', () => {
        const after = Date.UTC(2026, 2, 8, 4, 30); // Mar 7 23:30 EST.

        expect(nextFireAtMs(dailyAtNine, after, 'America/New_York')).toBe(
            Date.UTC(2026, 2, 8, 13, 0)
        );
    });

    it('fires once on the fall-back date', () => {
        const after = Date.UTC(2026, 10, 1, 3, 30); // Oct 31 23:30 EDT.
        const first = nextFireAtMs(dailyAtNine, after, 'America/New_York');

        expect(first).toBe(Date.UTC(2026, 10, 1, 14, 0));
        expect(nextFireAtMs(dailyAtNine, first, 'America/New_York')).toBe(
            Date.UTC(2026, 10, 2, 14, 0)
        );
    });
});
