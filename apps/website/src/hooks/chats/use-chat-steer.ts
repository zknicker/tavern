import { trpc } from '../../lib/trpc.tsx';

export function useChatSteer() {
    const utils = trpc.useUtils();

    return trpc.chat.steer.useMutation({
        onSuccess: async (_result, input) => {
            await Promise.all([
                utils.chat.get.invalidate({ chatId: input.chatId }),
                utils.chat.log.list.invalidate(),
                utils.session.list.invalidate(),
            ]);
        },
    });
}
