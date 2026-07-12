import { trpc } from '../../lib/trpc.tsx';

export function useChatUnarchive() {
    const utils = trpc.useUtils();

    return trpc.chat.unarchive.useMutation({
        onMutate: async ({ chatId }) => {
            await utils.chat.listArchived.cancel();
            const previousArchivedList = utils.chat.listArchived.getData();

            utils.chat.listArchived.setData(undefined, (current) => {
                if (!current) {
                    return current;
                }

                const { [chatId]: _restoredChat, ...itemsById } = current.itemsById;

                return {
                    ...current,
                    ids: current.ids.filter((id) => id !== chatId),
                    itemsById,
                };
            });

            return { previousArchivedList };
        },
        onError: (_error, _input, context) => {
            if (context?.previousArchivedList) {
                utils.chat.listArchived.setData(undefined, context.previousArchivedList);
            }
        },
        onSettled: async (_result, _error, { chatId }) => {
            await Promise.all([
                utils.chat.get.invalidate({ chatId }),
                utils.chat.list.invalidate(),
                utils.chat.listArchived.invalidate(),
            ]);
        },
    });
}
