import { trpc } from '../../lib/trpc.tsx';

export function useChatArchive() {
    const utils = trpc.useUtils();

    return trpc.chat.archive.useMutation({
        onMutate: async ({ chatId }) => {
            await utils.chat.list.cancel();
            const previousChatList = utils.chat.list.getData();

            utils.chat.list.setData(undefined, (current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    chats: current.chats.filter((chat) => chat.id !== chatId),
                };
            });

            return { previousChatList };
        },
        onError: (_error, _input, context) => {
            if (context?.previousChatList) {
                utils.chat.list.setData(undefined, context.previousChatList);
            }
        },
        onSettled: async () => {
            await utils.chat.list.invalidate();
        },
    });
}
