import { describe, expect, it } from 'vitest';
import { type Rect, shouldTearOff, TEAR_OFF_THRESHOLD_PX } from './tear-off.ts';

const strip: Rect = { top: 0, bottom: 40, left: 0, right: 1000 };

describe('shouldTearOff', () => {
    it('stays in the strip while the pointer reorders horizontally', () => {
        expect(shouldTearOff({ x: 500, y: 20 }, strip)).toBe(false);
        expect(shouldTearOff({ x: 500, y: strip.bottom + TEAR_OFF_THRESHOLD_PX - 1 }, strip)).toBe(
            false
        );
    });

    it('tears off when dragged down into the content past the threshold', () => {
        expect(shouldTearOff({ x: 500, y: strip.bottom + TEAR_OFF_THRESHOLD_PX + 1 }, strip)).toBe(
            true
        );
    });

    it('tears off when dragged out of any window edge', () => {
        expect(shouldTearOff({ x: -100, y: 20 }, strip)).toBe(true);
        expect(shouldTearOff({ x: 1200, y: 20 }, strip)).toBe(true);
        expect(shouldTearOff({ x: 500, y: -100 }, strip)).toBe(true);
    });
});
