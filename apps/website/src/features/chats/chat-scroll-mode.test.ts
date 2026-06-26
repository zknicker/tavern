import { describe, expect, test } from 'bun:test';
import {
    getAnchorScrollDelta,
    getVirtualizerSizeAdjustmentPredicate,
    initialChatScrollMode,
    isNearBottom,
    shouldAnchorVirtualizerToEnd,
    transitionChatScrollMode,
} from './chat-scroll-mode.ts';

describe('transitionChatScrollMode', () => {
    test('starts in following so the initial render pins the bottom', () => {
        expect(initialChatScrollMode).toBe('following');
    });

    test('content resize while following pins the bottom (auto-collapse keeps the reply pinned)', () => {
        expect(transitionChatScrollMode('following', { type: 'contentResized' })).toEqual({
            action: 'pinBottom',
            mode: 'following',
        });
    });

    test('content resize while anchored never writes a follow scroll', () => {
        expect(transitionChatScrollMode('anchored', { type: 'contentResized' })).toEqual({
            action: 'none',
            mode: 'anchored',
        });
    });

    test('content resize while free leaves the position alone', () => {
        expect(transitionChatScrollMode('free', { type: 'contentResized' })).toEqual({
            action: 'none',
            mode: 'free',
        });
    });

    test('a follow request scrolls to bottom from any mode', () => {
        for (const mode of ['following', 'anchored', 'free', 'historyNavigating'] as const) {
            expect(transitionChatScrollMode(mode, { type: 'followRequested' })).toEqual({
                action: 'scrollToBottom',
                mode: 'following',
            });
        }
    });

    test('history navigation leaves bottom-follow before the virtualizer scroll write', () => {
        for (const mode of ['following', 'anchored', 'free'] as const) {
            expect(transitionChatScrollMode(mode, { type: 'historyNavigationStarted' })).toEqual({
                action: 'none',
                mode: 'historyNavigating',
            });
        }
    });

    test('history navigation does not resume following during near-bottom smooth-scroll frames', () => {
        expect(
            transitionChatScrollMode('historyNavigating', {
                isAtBottom: true,
                type: 'scrolled',
                userInitiated: false,
            })
        ).toEqual({ action: 'none', mode: 'historyNavigating' });
        expect(
            transitionChatScrollMode('historyNavigating', {
                isAtBottom: false,
                type: 'scrolled',
                userInitiated: false,
            })
        ).toEqual({ action: 'none', mode: 'free' });
    });

    test('history navigation settles to the final bottom state', () => {
        expect(
            transitionChatScrollMode('historyNavigating', {
                isAtBottom: true,
                type: 'historyNavigationSettled',
            })
        ).toEqual({ action: 'none', mode: 'following' });
        expect(
            transitionChatScrollMode('historyNavigating', {
                isAtBottom: false,
                type: 'historyNavigationSettled',
            })
        ).toEqual({ action: 'none', mode: 'free' });
        expect(
            transitionChatScrollMode('free', {
                isAtBottom: true,
                type: 'historyNavigationSettled',
            })
        ).toEqual({ action: 'none', mode: 'free' });
    });

    test('anchor start takes ownership from any mode', () => {
        for (const mode of ['following', 'anchored', 'free', 'historyNavigating'] as const) {
            expect(transitionChatScrollMode(mode, { type: 'anchorStarted' })).toEqual({
                action: 'none',
                mode: 'anchored',
            });
        }
    });

    test('anchor end resumes following only when the viewport is near bottom', () => {
        expect(
            transitionChatScrollMode('anchored', { isAtBottom: true, type: 'anchorEnded' })
        ).toEqual({ action: 'none', mode: 'following' });
        expect(
            transitionChatScrollMode('anchored', { isAtBottom: false, type: 'anchorEnded' })
        ).toEqual({ action: 'none', mode: 'free' });
    });

    test('a stale anchor end is ignored outside anchored mode', () => {
        expect(
            transitionChatScrollMode('following', { isAtBottom: false, type: 'anchorEnded' })
        ).toEqual({ action: 'none', mode: 'following' });
        expect(
            transitionChatScrollMode('historyNavigating', {
                isAtBottom: false,
                type: 'anchorEnded',
            })
        ).toEqual({ action: 'none', mode: 'historyNavigating' });
    });

    test('scroll events from anchor writes do not cancel the anchor', () => {
        expect(
            transitionChatScrollMode('anchored', {
                isAtBottom: false,
                type: 'scrolled',
                userInitiated: false,
            })
        ).toEqual({ action: 'none', mode: 'anchored' });
    });

    test('user wheel or touch input during an anchor cancels it — user intent wins', () => {
        expect(
            transitionChatScrollMode('anchored', { isAtBottom: false, type: 'userScrolled' })
        ).toEqual({ action: 'none', mode: 'free' });
        expect(
            transitionChatScrollMode('anchored', { isAtBottom: true, type: 'userScrolled' })
        ).toEqual({ action: 'none', mode: 'following' });
    });

    test('passive scroll drift while following re-pins bottom instead of leaving follow mode', () => {
        expect(
            transitionChatScrollMode('following', {
                isAtBottom: false,
                type: 'scrolled',
                userInitiated: false,
            })
        ).toEqual({ action: 'pinBottom', mode: 'following' });
    });

    test('user-initiated scrolling tracks following versus free by bottom proximity', () => {
        expect(
            transitionChatScrollMode('following', {
                isAtBottom: false,
                type: 'scrolled',
                userInitiated: true,
            })
        ).toEqual({ action: 'none', mode: 'free' });
        expect(
            transitionChatScrollMode('free', {
                isAtBottom: true,
                type: 'scrolled',
                userInitiated: true,
            })
        ).toEqual({
            action: 'none',
            mode: 'following',
        });
    });

    test('passive scroll to bottom resumes following from free mode', () => {
        expect(
            transitionChatScrollMode('free', {
                isAtBottom: true,
                type: 'scrolled',
                userInitiated: false,
            })
        ).toEqual({
            action: 'none',
            mode: 'following',
        });
    });
});

describe('getAnchorScrollDelta', () => {
    test('returns the correction when the trigger moved', () => {
        expect(getAnchorScrollDelta({ capturedTop: 100, currentTop: 60 })).toBe(-40);
        expect(getAnchorScrollDelta({ capturedTop: 100, currentTop: 140.5 })).toBe(40.5);
    });

    test('returns null when the trigger has not moved (collapse anchored at scrollTop 0 writes nothing)', () => {
        expect(getAnchorScrollDelta({ capturedTop: 100, currentTop: 100 })).toBeNull();
        expect(getAnchorScrollDelta({ capturedTop: 100, currentTop: 100.4 })).toBeNull();
    });
});

describe('virtualizer ownership helpers', () => {
    test('TanStack end anchoring is suspended only during drawer anchoring', () => {
        expect(shouldAnchorVirtualizerToEnd('following')).toBe(true);
        expect(shouldAnchorVirtualizerToEnd('free')).toBe(true);
        expect(shouldAnchorVirtualizerToEnd('historyNavigating')).toBe(true);
        expect(shouldAnchorVirtualizerToEnd('anchored')).toBe(false);
    });

    test('TanStack size-change adjustment keeps tail row growth pinned while following', () => {
        expect(getVirtualizerSizeAdjustmentPredicate('following')?.()).toBe(true);
        expect(getVirtualizerSizeAdjustmentPredicate('free')).toBeUndefined();
        expect(getVirtualizerSizeAdjustmentPredicate('historyNavigating')).toBeUndefined();
        expect(getVirtualizerSizeAdjustmentPredicate('anchored')?.()).toBe(false);
    });
});

describe('isNearBottom', () => {
    test('applies the near-bottom tolerance', () => {
        expect(isNearBottom({ clientHeight: 600, scrollHeight: 1000, scrollTop: 400 })).toBe(true);
        expect(isNearBottom({ clientHeight: 600, scrollHeight: 1000, scrollTop: 352 })).toBe(true);
        expect(isNearBottom({ clientHeight: 600, scrollHeight: 1000, scrollTop: 351 })).toBe(false);
    });
});
