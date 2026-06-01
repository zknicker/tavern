import { trpc } from '../../lib/trpc.tsx';

export function useChatTabAppearance() {
    const utils = trpc.useUtils();

    return trpc.chat.updateTabAppearance.useMutation({
        onMutate: async ({ chatId, color }) => {
            await utils.chat.list.cancel();
            await utils.chat.get.cancel({ chatId });
            const previousChatList = utils.chat.list.getData();
            const previousChat = utils.chat.get.getData({ chatId });
            const tabAppearance = { color };

            utils.chat.list.setData(undefined, (current) => {
                if (!current?.itemsById[chatId]) {
                    return current;
                }

                return {
                    ...current,
                    itemsById: {
                        ...current.itemsById,
                        [chatId]: {
                            ...current.itemsById[chatId],
                            tabAppearance,
                        },
                    },
                };
            });
            utils.chat.get.setData({ chatId }, (current) =>
                current ? { ...current, tabAppearance } : current
            );

            return { previousChat, previousChatList };
        },
        onError: (_error, _input, context) => {
            if (context?.previousChatList) {
                utils.chat.list.setData(undefined, context.previousChatList);
            }

            if (context?.previousChat) {
                utils.chat.get.setData({ chatId: context.previousChat.id }, context.previousChat);
            }
        },
        onSettled: async (_result, _error, { chatId }) => {
            await Promise.all([
                utils.chat.get.invalidate({ chatId }),
                utils.chat.list.invalidate(),
            ]);
        },
    });
}
