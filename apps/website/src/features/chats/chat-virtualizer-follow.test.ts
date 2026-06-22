import { expect, test } from 'bun:test';
import { Virtualizer, type VirtualizerOptions } from '@tanstack/react-virtual';
import { chatVirtualizerFollowOnAppendBehavior } from './virtualized-chat-transcript.tsx';

test('virtualized chat keeps growing tail rows pinned while following appends', () => {
    expect(getDistanceFromEndAfterTailGrowth(chatVirtualizerFollowOnAppendBehavior)).toBe(0);
});

function getDistanceFromEndAfterTailGrowth(followOnAppend: ScrollBehavior) {
    const harness = createTailGrowthVirtualizer(followOnAppend);

    harness.appendTail();
    harness.resizeTail(400);

    return harness.virtualizer.getDistanceFromEnd();
}

function createTailGrowthVirtualizer(followOnAppend: ScrollBehavior) {
    let keys = ['intro'];
    let sizes = [100];
    let scrollTop = 0;
    let scrollOffsetCallback: ((offset: number, isScrolling: boolean) => void) | null = null;
    let virtualizer: Virtualizer<HTMLElement, HTMLElement>;
    const fakeWindow = createVirtualizerWindow();
    const scrollElement = {
        addEventListener: () => undefined,
        clientHeight: 100,
        get scrollHeight() {
            return virtualizer.getTotalSize();
        },
        ownerDocument: { defaultView: fakeWindow },
        removeEventListener: () => undefined,
        scrollTo: (options: ScrollToOptions) => {
            scrollTop = options.top ?? scrollTop;
            scrollOffsetCallback?.(scrollTop, false);
        },
    } as unknown as HTMLElement;
    const makeOptions = (): VirtualizerOptions<HTMLElement, HTMLElement> => ({
        anchorTo: 'end',
        count: keys.length,
        estimateSize: (index) => sizes[index] ?? 100,
        followOnAppend,
        getItemKey: (index) => keys[index] ?? index,
        getScrollElement: () => scrollElement,
        observeElementOffset: (_instance, callback) => {
            scrollOffsetCallback = callback;
            callback(scrollTop, false);
            return () => undefined;
        },
        observeElementRect: (_instance, callback) => {
            callback({ height: 100, width: 320 });
            return () => undefined;
        },
        overscan: 2,
        scrollEndThreshold: 1,
        scrollToFn: (offset, { adjustments = 0, behavior }) => {
            scrollElement.scrollTo({ behavior, top: offset + adjustments });
        },
    });

    virtualizer = new Virtualizer(makeOptions());
    virtualizer._willUpdate();
    virtualizer.getVirtualItems();
    virtualizer.resizeItem(0, 100);

    return {
        appendTail: () => {
            keys = ['intro', 'rich-response'];
            sizes = [100, 100];
            virtualizer.setOptions(makeOptions());
            virtualizer._willUpdate();
            virtualizer.getVirtualItems();
        },
        resizeTail: (size: number) => {
            virtualizer.resizeItem(1, size);
        },
        virtualizer,
    };
}

function createVirtualizerWindow() {
    return {
        cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
        clearTimeout,
        performance: { now: () => Date.now() },
        requestAnimationFrame: (callback: FrameRequestCallback) =>
            setTimeout(() => callback(Date.now()), 0),
        setTimeout,
    };
}
