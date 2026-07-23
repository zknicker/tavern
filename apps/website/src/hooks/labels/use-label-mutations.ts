import { trpc } from '../../lib/trpc.tsx';

function useLabelInvalidation() {
    const utils = trpc.useUtils();
    return async () => {
        await Promise.all([utils.label.list.invalidate(), utils.task.list.invalidate()]);
    };
}

export function useLabelCreate() {
    const invalidate = useLabelInvalidation();
    return trpc.label.create.useMutation({ onSuccess: invalidate });
}

export function useLabelUpdate() {
    const invalidate = useLabelInvalidation();
    return trpc.label.update.useMutation({ onSuccess: invalidate });
}

export function useLabelDelete() {
    const invalidate = useLabelInvalidation();
    return trpc.label.delete.useMutation({ onSuccess: invalidate });
}
