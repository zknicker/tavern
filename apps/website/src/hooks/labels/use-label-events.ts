import { trpc } from '../../lib/trpc.tsx';

// Owns the labels.onUpdate subscription. A label change can rename or recolor
// chips on any task, so it refreshes the catalog and task lists together.
export function useLabelEvents() {
    const utils = trpc.useUtils();

    trpc.labels.onUpdate.useSubscription(undefined, {
        onData: () => {
            Promise.all([
                utils.labels.list.invalidate(),
                utils.tasks.get.invalidate(),
                utils.tasks.list.invalidate(),
            ]).catch(() => undefined);
        },
    });
}
