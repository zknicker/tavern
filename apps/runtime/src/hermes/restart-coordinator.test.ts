import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRestartCoordinator } from './restart-coordinator';

describe('restart coordinator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('coalesces a burst of settings saves into one restart', () => {
        const restart = vi.fn();
        const coordinator = createRestartCoordinator({
            hasActiveTurns: () => false,
            restart,
        });

        coordinator.request();
        vi.advanceTimersByTime(1000);
        coordinator.request();
        vi.advanceTimersByTime(1000);
        coordinator.request();
        expect(restart).not.toHaveBeenCalled();

        vi.advanceTimersByTime(3000);
        expect(restart).toHaveBeenCalledTimes(1);
    });

    test('defers the restart while a chat turn is active', () => {
        const restart = vi.fn();
        let turnActive = true;
        const coordinator = createRestartCoordinator({
            hasActiveTurns: () => turnActive,
            restart,
        });

        coordinator.request();
        vi.advanceTimersByTime(10_000);
        expect(restart).not.toHaveBeenCalled();

        turnActive = false;
        vi.advanceTimersByTime(1000);
        expect(restart).toHaveBeenCalledTimes(1);
    });

    test('restarts anyway past the deferral cap and relies on engine drain', () => {
        const restart = vi.fn();
        const coordinator = createRestartCoordinator({
            hasActiveTurns: () => true,
            restart,
        });

        coordinator.request();
        vi.advanceTimersByTime(59_000);
        expect(restart).not.toHaveBeenCalled();

        vi.advanceTimersByTime(5000);
        expect(restart).toHaveBeenCalledTimes(1);
    });

    test('a new burst after a restart schedules another restart', () => {
        const restart = vi.fn();
        const coordinator = createRestartCoordinator({
            hasActiveTurns: () => false,
            restart,
        });

        coordinator.request();
        vi.advanceTimersByTime(3000);
        coordinator.request();
        vi.advanceTimersByTime(3000);

        expect(restart).toHaveBeenCalledTimes(2);
    });

    test('dispose cancels pending restarts', () => {
        const restart = vi.fn();
        const coordinator = createRestartCoordinator({
            hasActiveTurns: () => false,
            restart,
        });

        coordinator.request();
        coordinator.dispose();
        vi.advanceTimersByTime(10_000);

        expect(restart).not.toHaveBeenCalled();
        coordinator.request();
        vi.advanceTimersByTime(10_000);
        expect(restart).not.toHaveBeenCalled();
    });
});
