import type { trpc } from '../../lib/trpc.tsx';

type TrpcUtils = ReturnType<typeof trpc.useUtils>;

export function invalidateModelList(utils: TrpcUtils) {
    return utils.model.list.invalidate(undefined, { refetchType: 'all' });
}
