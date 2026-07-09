import { trpc } from '../../lib/trpc.tsx';

// Label edits ripple into task records (renamed/recolored/removed labels), so
// each mutation refreshes both the catalog and task lists.
function useInvalidateLabels() {
    const utils = trpc.useUtils();

    return async () => {
        await Promise.all([
            utils.labels.list.invalidate(),
            utils.tasks.get.invalidate(),
            utils.tasks.list.invalidate(),
        ]);
    };
}

export function useLabelCreate() {
    const invalidate = useInvalidateLabels();

    return trpc.labels.create.useMutation({ onSuccess: invalidate });
}

export function useLabelUpdate() {
    const invalidate = useInvalidateLabels();

    return trpc.labels.update.useMutation({ onSuccess: invalidate });
}

export function useLabelDelete() {
    const invalidate = useInvalidateLabels();

    return trpc.labels.delete.useMutation({ onSuccess: invalidate });
}
