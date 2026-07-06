import { trpc } from '../../lib/trpc.tsx';

export function useTaskEvents() {
    const utils = trpc.useUtils();

    trpc.tasks.onUpdate.useSubscription(undefined, {
        onData: () => {
            Promise.all([utils.tasks.get.invalidate(), utils.tasks.list.invalidate()]).catch(
                () => undefined
            );
        },
    });
}
