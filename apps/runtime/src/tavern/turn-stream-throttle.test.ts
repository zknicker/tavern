import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTurnStreamThrottle } from './turn-stream-throttle.ts';

const interval = 100;

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

it('runs the first write for an idle key immediately', () => {
    const throttle = createTurnStreamThrottle(interval);
    const writes: string[] = [];

    throttle.schedule('reply', () => writes.push('a'));

    expect(writes).toEqual(['a']);
});

it('coalesces writes within the window to the latest one', () => {
    const throttle = createTurnStreamThrottle(interval);
    const writes: string[] = [];

    throttle.schedule('reply', () => writes.push('a'));
    throttle.schedule('reply', () => writes.push('b'));
    throttle.schedule('reply', () => writes.push('c'));

    expect(writes).toEqual(['a']);

    vi.advanceTimersByTime(interval);

    expect(writes).toEqual(['a', 'c']);
});

it('flush runs pending writes immediately and cancels their timers', () => {
    const throttle = createTurnStreamThrottle(interval);
    const writes: string[] = [];

    throttle.schedule('reply', () => writes.push('a'));
    throttle.schedule('reply', () => writes.push('b'));
    throttle.flush();

    expect(writes).toEqual(['a', 'b']);

    vi.advanceTimersByTime(interval * 2);

    expect(writes).toEqual(['a', 'b']);
});

it('throttles keys independently', () => {
    const throttle = createTurnStreamThrottle(interval);
    const writes: string[] = [];

    throttle.schedule('reply', () => writes.push('reply'));
    throttle.schedule('tool:call-1', () => writes.push('tool'));

    expect(writes).toEqual(['reply', 'tool']);
});

it('keeps throttling after a flush until the window has elapsed', () => {
    const throttle = createTurnStreamThrottle(interval);
    const writes: string[] = [];

    throttle.schedule('reply', () => writes.push('a'));
    throttle.schedule('reply', () => writes.push('b'));
    throttle.flush();
    throttle.schedule('reply', () => writes.push('c'));

    expect(writes).toEqual(['a', 'b']);

    vi.advanceTimersByTime(interval);

    expect(writes).toEqual(['a', 'b', 'c']);
});

it('honors a per-call interval override', () => {
    const throttle = createTurnStreamThrottle(1000);
    const writes: string[] = [];

    throttle.schedule('reply', () => writes.push('a'), 50);
    throttle.schedule('reply', () => writes.push('b'), 50);

    vi.advanceTimersByTime(50);

    expect(writes).toEqual(['a', 'b']);
});
