import { trpc } from '../../lib/trpc.tsx';
import { useChatStartDrafts } from './use-chat-start-drafts.tsx';

export function useChatArchive() {
    const drafts = useChatStartDrafts();
    const utils = trpc.useUtils();

    return trpc.chat.archive.useMutation({
        onMutate: async ({ chatId }) => {
            await utils.chat.list.cancel();
            await utils.chat.get.cancel({ chatId });
            const previousChatList = utils.chat.list.getData();
            const previousChat = utils.chat.get.getData({ chatId });
            const removedDrafts = drafts.removeReconciledDrafts(chatId);

            utils.chat.list.setData(undefined, (current) => {
                if (!current) {
                    return current;
                }

                const { [chatId]: _archivedChat, ...itemsById } = current.itemsById;

                return {
                    ...current,
                    ids: current.ids.filter((id) => id !== chatId),
                    itemsById,
                };
            });
            utils.chat.get.setData({ chatId }, null);

            return { previousChat, previousChatList, removedDrafts };
        },
        onError: (_error, _input, context) => {
            if (context?.previousChatList) {
                utils.chat.list.setData(undefined, context.previousChatList);
            }

            if (context?.previousChat) {
                utils.chat.get.setData({ chatId: context.previousChat.id }, context.previousChat);
            }

            if (context?.removedDrafts) {
                drafts.restoreDrafts(context.removedDrafts);
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
