import * as React from 'react';
import { type AppRouterInputs, trpc } from '../../lib/trpc.tsx';

type TaskUpdatePatch = AppRouterInputs['tasks']['update']['patch'];

export interface BulkTaskUpdate {
    patch: TaskUpdatePatch;
    taskId: string;
}

export interface BulkTaskUpdateResult {
    failed: number;
    total: number;
}

function useInvalidateTasks() {
    const utils = trpc.useUtils();

    return async () => {
        await Promise.all([utils.tasks.get.invalidate(), utils.tasks.list.invalidate()]);
    };
}

/**
 * Applies a patch to many tasks at once. Requests fire together and settle
 * independently so one rejection never blocks the rest; the caller learns how
 * many failed and the cache invalidates once after everything settles.
 */
export function useTaskBulkUpdate() {
    const utils = trpc.useUtils();
    const mutation = trpc.tasks.update.useMutation();

    return React.useCallback(
        async (updates: BulkTaskUpdate[]): Promise<BulkTaskUpdateResult> => {
            const results = await Promise.allSettled(
                updates.map((update) =>
                    mutation.mutateAsync({ patch: update.patch, taskId: update.taskId })
                )
            );
            await Promise.all([utils.tasks.get.invalidate(), utils.tasks.list.invalidate()]);

            return {
                failed: results.filter((result) => result.status === 'rejected').length,
                total: updates.length,
            };
        },
        [mutation, utils]
    );
}

export function useTaskCreate() {
    const invalidate = useInvalidateTasks();

    return trpc.tasks.create.useMutation({ onSuccess: invalidate });
}

export function useTaskUpdate() {
    const invalidate = useInvalidateTasks();

    return trpc.tasks.update.useMutation({ onSuccess: invalidate });
}

export function useTaskDelete() {
    const invalidate = useInvalidateTasks();

    return trpc.tasks.delete.useMutation({ onSuccess: invalidate });
}

export function useTaskDispatch() {
    const invalidate = useInvalidateTasks();

    return trpc.tasks.dispatch.useMutation({ onSuccess: invalidate });
}
