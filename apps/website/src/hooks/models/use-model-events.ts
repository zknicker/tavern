import { trpc } from '../../lib/trpc.tsx';
import { invalidateModelList } from './invalidate-model-list.ts';

export function useModelEvents() {
    const utils = trpc.useUtils();

    trpc.model.onUpdate.useSubscription(undefined, {
        onData: () => {
            void Promise.all([utils.model.inventory.invalidate(), invalidateModelList(utils)]);
        },
    });
}
