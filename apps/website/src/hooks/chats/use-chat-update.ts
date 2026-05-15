import { trpc } from '../../lib/trpc.tsx';

export function useChatUpdate() {
    const utils = trpc.useUtils();

    return trpc.chat.update.useMutation({
        onSuccess: async () => {
            await utils.chat.list.invalidate();
        },
    });
}
