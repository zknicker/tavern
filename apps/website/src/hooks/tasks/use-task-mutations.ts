import { trpc } from '../../lib/trpc.tsx';

function useInvalidateTasks() {
    const utils = trpc.useUtils();

    return async () => {
        await Promise.all([utils.tasks.get.invalidate(), utils.tasks.list.invalidate()]);
    };
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
