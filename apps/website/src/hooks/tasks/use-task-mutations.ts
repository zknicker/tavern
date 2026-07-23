import { trpc } from '../../lib/trpc.tsx';

function useTaskMutationInvalidation() {
    const utils = trpc.useUtils();
    return async () => {
        await Promise.all([utils.task.list.invalidate(), utils.chat.log.list.invalidate()]);
    };
}

export function useTaskConvert() {
    const invalidate = useTaskMutationInvalidation();
    return trpc.task.convert.useMutation({ onSuccess: invalidate });
}

export function useTaskUpdate() {
    const invalidate = useTaskMutationInvalidation();
    return trpc.task.update.useMutation({ onSuccess: invalidate });
}

export interface BulkTaskUpdate {
    patch: {
        assigneeId?: string | null;
        labelIds?: string[];
        priority?: 'none' | 'urgent' | 'high' | 'medium' | 'low';
        status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';
    };
    taskId: string;
}

export interface BulkTaskUpdateResult {
    failed: number;
    total: number;
}

// Fans one patch across a board multi-selection; partial failures surface in
// the result so the bulk bar can toast them.
export function useTaskBulkUpdate() {
    const update = trpc.task.update.useMutation();
    const invalidate = useTaskMutationInvalidation();

    return async (updates: BulkTaskUpdate[]): Promise<BulkTaskUpdateResult> => {
        const results = await Promise.allSettled(
            updates.map((entry) =>
                update.mutateAsync({ messageId: entry.taskId, patch: entry.patch })
            )
        );
        await invalidate();

        return {
            failed: results.filter((result) => result.status === 'rejected').length,
            total: results.length,
        };
    };
}
