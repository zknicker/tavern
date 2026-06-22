import { describe, expect, test } from 'bun:test';
import {
    getChatFollowScrollAnimationDurationMs,
    getChatFollowScrollFrameOffset,
    shouldAnimateChatFollowScrollWrite,
} from './chat-scroll-animation.ts';

describe('shouldAnimateChatFollowScrollWrite', () => {
    test('animates medium auto writes while following', () => {
        expect(
            shouldAnimateChatFollowScrollWrite({
                distancePx: 800,
                isInitialScrollPending: false,
                mode: 'following',
                reduceMotion: false,
                requestedBehavior: 'auto',
            })
        ).toBe(true);
    });

    test('keeps initial, explicit, reduced-motion, and non-follow writes immediate', () => {
        expect(
            shouldAnimateChatFollowScrollWrite({
                distancePx: 800,
                isInitialScrollPending: true,
                mode: 'following',
                reduceMotion: false,
                requestedBehavior: 'auto',
            })
        ).toBe(false);
        expect(
            shouldAnimateChatFollowScrollWrite({
                distancePx: 800,
                isInitialScrollPending: false,
                mode: 'following',
                reduceMotion: false,
                requestedBehavior: 'smooth',
            })
        ).toBe(false);
        expect(
            shouldAnimateChatFollowScrollWrite({
                distancePx: 800,
                isInitialScrollPending: false,
                mode: 'following',
                reduceMotion: true,
                requestedBehavior: 'auto',
            })
        ).toBe(false);
        expect(
            shouldAnimateChatFollowScrollWrite({
                distancePx: 800,
                isInitialScrollPending: false,
                mode: 'free',
                reduceMotion: false,
                requestedBehavior: 'auto',
            })
        ).toBe(false);
    });

    test('leaves tiny nudges and huge jumps immediate', () => {
        expect(
            shouldAnimateChatFollowScrollWrite({
                distancePx: 24,
                isInitialScrollPending: false,
                mode: 'following',
                reduceMotion: false,
                requestedBehavior: 'auto',
            })
        ).toBe(false);
        expect(
            shouldAnimateChatFollowScrollWrite({
                distancePx: 2000,
                isInitialScrollPending: false,
                mode: 'following',
                reduceMotion: false,
                requestedBehavior: 'auto',
            })
        ).toBe(false);
    });
});

describe('getChatFollowScrollAnimationDurationMs', () => {
    test('scales medium scroll distance without exceeding the cap', () => {
        expect(getChatFollowScrollAnimationDurationMs(800)).toBe(360);
        expect(getChatFollowScrollAnimationDurationMs(24)).toBe(180);
        expect(getChatFollowScrollAnimationDurationMs(2000)).toBe(420);
    });
});

describe('getChatFollowScrollFrameOffset', () => {
    test('caps delayed animation frames to avoid visible catch-up jumps', () => {
        expect(getChatFollowScrollFrameOffset({ current: 807, desired: 1606 })).toBe(935);
        expect(getChatFollowScrollFrameOffset({ current: 807, desired: 860 })).toBe(860);
        expect(getChatFollowScrollFrameOffset({ current: 1606, desired: 807 })).toBe(1478);
    });
});
