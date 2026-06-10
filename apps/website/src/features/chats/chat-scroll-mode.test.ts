import { describe, expect, test } from 'bun:test';
import {
    getAnchorScrollDelta,
    initialChatScrollMode,
    isNearBottom,
    shouldVirtualizerAdjustForItem,
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
        for (const mode of ['following', 'anchored', 'free'] as const) {
            expect(transitionChatScrollMode(mode, { type: 'followRequested' })).toEqual({
                action: 'scrollToBottom',
                mode: 'following',
            });
        }
    });

    test('anchor start takes ownership from any mode', () => {
        for (const mode of ['following', 'anchored', 'free'] as const) {
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
    });

    test('scroll events from anchor writes do not cancel the anchor', () => {
        expect(
            transitionChatScrollMode('anchored', { isAtBottom: false, type: 'scrolled' })
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

    test('scrolling tracks following versus free by bottom proximity', () => {
        expect(
            transitionChatScrollMode('following', { isAtBottom: false, type: 'scrolled' })
        ).toEqual({ action: 'none', mode: 'free' });
        expect(transitionChatScrollMode('free', { isAtBottom: true, type: 'scrolled' })).toEqual({
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

describe('shouldVirtualizerAdjustForItem', () => {
    test('compensates only in free mode for items above the viewport', () => {
        expect(
            shouldVirtualizerAdjustForItem({ itemStart: 50, mode: 'free', scrollTop: 400 })
        ).toBe(true);
        expect(
            shouldVirtualizerAdjustForItem({ itemStart: 500, mode: 'free', scrollTop: 400 })
        ).toBe(false);
    });

    test('never compensates while following or anchored', () => {
        expect(
            shouldVirtualizerAdjustForItem({ itemStart: 50, mode: 'following', scrollTop: 400 })
        ).toBe(false);
        expect(
            shouldVirtualizerAdjustForItem({ itemStart: 50, mode: 'anchored', scrollTop: 400 })
        ).toBe(false);
    });
});

describe('isNearBottom', () => {
    test('applies the 72px tolerance', () => {
        expect(isNearBottom({ clientHeight: 600, scrollHeight: 1000, scrollTop: 400 })).toBe(true);
        expect(isNearBottom({ clientHeight: 600, scrollHeight: 1000, scrollTop: 328 })).toBe(true);
        expect(isNearBottom({ clientHeight: 600, scrollHeight: 1000, scrollTop: 327 })).toBe(false);
    });
});
