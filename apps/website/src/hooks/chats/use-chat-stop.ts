import { trpc } from '../../lib/trpc.tsx';

export function useChatStop() {
    const utils = trpc.useUtils();

    return trpc.chat.stop.useMutation({
        onSuccess: async (_result, input) => {
            await Promise.all([
                utils.chat.get.invalidate({ chatId: input.chatId }),
                utils.chat.log.list.invalidate(),
                utils.session.list.invalidate(),
            ]);
        },
    });
}
