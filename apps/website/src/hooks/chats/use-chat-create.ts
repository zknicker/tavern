import { trpc } from '../../lib/trpc.tsx';

export function useChatCreate() {
    const utils = trpc.useUtils();

    return trpc.chat.create.useMutation({
        onSuccess: async () => {
            await utils.chat.list.invalidate();
        },
    });
}
