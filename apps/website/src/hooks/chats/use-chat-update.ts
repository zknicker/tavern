import { trpc } from '../../lib/trpc.tsx';

export function useChatUpdate() {
    const utils = trpc.useUtils();

    return trpc.chat.update.useMutation({
        onSuccess: async (_result, input) => {
            await Promise.all([
                utils.chat.get.invalidate({ chatId: input.chatId }),
                utils.chat.list.invalidate(),
            ]);
        },
    });
}
