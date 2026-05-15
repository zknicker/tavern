import { expect, mock, test } from 'bun:test';
import { invalidateModelList } from './invalidate-model-list.ts';

test('invalidateModelList refetches inactive model list queries', async () => {
    const invalidate = mock(async () => undefined);

    await invalidateModelList({
        model: {
            list: {
                invalidate,
            },
        },
    } as never);

    expect(invalidate.mock.calls[0] as unknown).toEqual([undefined, { refetchType: 'all' }]);
});
