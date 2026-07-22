import { expect, test } from 'bun:test';
import { shouldShowTasksRuntimeUnavailable } from './tasks-view.tsx';

test('cached empty task results remain available while Runtime is offline', () => {
    expect(
        shouldShowTasksRuntimeUnavailable({ connectionState: 'unreachable', hasTaskData: true })
    ).toBe(false);
    expect(
        shouldShowTasksRuntimeUnavailable({ connectionState: 'unreachable', hasTaskData: false })
    ).toBe(true);
});
