import { describe, expect, test } from 'bun:test';
import { resolveGradientProgress } from './avatar-renderer.ts';

describe('resolveGradientProgress', () => {
    const stripeProfile = {
        stripeOffset: 0,
        stripeSpacing: 3,
        stripeStrength: 0.12,
        stripeThickness: 1,
    };

    test('adds stripe variation within the same gradient band', () => {
        const topRight = resolveGradientProgress({
            column: 2,
            columns: 6,
            row: 0,
            rows: 6,
            ...stripeProfile,
        });
        const bottomLeft = resolveGradientProgress({
            column: 1,
            columns: 6,
            row: 1,
            rows: 6,
            ...stripeProfile,
        });

        expect(topRight).not.toBe(bottomLeft);
    });

    test('progresses across diagonals from top-left to bottom-right', () => {
        const start = resolveGradientProgress({
            column: 0,
            columns: 6,
            stripeOffset: stripeProfile.stripeOffset,
            stripeSpacing: stripeProfile.stripeSpacing,
            stripeStrength: stripeProfile.stripeStrength,
            stripeThickness: stripeProfile.stripeThickness,
            row: 0,
            rows: 6,
        });
        const end = resolveGradientProgress({
            column: 5,
            columns: 6,
            stripeOffset: stripeProfile.stripeOffset,
            stripeSpacing: stripeProfile.stripeSpacing,
            stripeStrength: stripeProfile.stripeStrength,
            stripeThickness: stripeProfile.stripeThickness,
            row: 5,
            rows: 6,
        });

        expect(start).toBeGreaterThanOrEqual(0);
        expect(start).toBeLessThan(0.2);
        expect(end).toBe(1);
        expect(end).toBeGreaterThan(start);
    });

    test('carries stripe variation all the way to the top edge', () => {
        const topLeft = resolveGradientProgress({
            column: 0,
            columns: 6,
            row: 0,
            rows: 6,
            ...stripeProfile,
        });
        const topBand = resolveGradientProgress({
            column: 2,
            columns: 6,
            row: 0,
            rows: 6,
            ...stripeProfile,
        });

        expect(topLeft).not.toBe(topBand);
    });

    test('preserves the same stripe line while moving down-right', () => {
        const upper = resolveGradientProgress({
            column: 1,
            columns: 6,
            row: 0,
            rows: 6,
            ...stripeProfile,
        });
        const lower = resolveGradientProgress({
            column: 2,
            columns: 6,
            row: 1,
            rows: 6,
            ...stripeProfile,
        });

        expect(lower - upper).toBeCloseTo(0.2, 5);
    });

    test('changing the stripe offset changes the visible pattern for the same cell', () => {
        const shifted = resolveGradientProgress({
            column: 1,
            columns: 6,
            row: 0,
            rows: 6,
            stripeOffset: -1,
            stripeSpacing: 3,
            stripeStrength: 0.12,
            stripeThickness: 1,
        });
        const unshifted = resolveGradientProgress({
            column: 1,
            columns: 6,
            row: 0,
            rows: 6,
            stripeOffset: 0,
            stripeSpacing: 3,
            stripeStrength: 0.12,
            stripeThickness: 1,
        });

        expect(shifted).not.toBe(unshifted);
    });
});
