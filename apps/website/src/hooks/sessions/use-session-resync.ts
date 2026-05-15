import { trpc } from '../../lib/trpc.tsx';

export function useSessionResync() {
    const utils = trpc.useUtils();

    return trpc.session.resync.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.chat.log.list.invalidate(),
                utils.session.get.invalidate(),
                utils.session.history.get.invalidate(),
                utils.session.list.invalidate(),
                utils.session.tool.get.invalidate(),
            ]);
        },
    });
}
