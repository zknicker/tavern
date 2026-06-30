import { trpc } from '../../lib/trpc.tsx';

export function useChatStartAgentSession() {
    const utils = trpc.useUtils();

    return trpc.chat.startAgentSession.useMutation({
        onSuccess: (result) => {
            void utils.chat.get.invalidate({ chatId: result.chatId });
            void utils.chat.list.invalidate();
            void utils.chat.log.list.invalidate({ id: result.chatId });
        },
    });
}
