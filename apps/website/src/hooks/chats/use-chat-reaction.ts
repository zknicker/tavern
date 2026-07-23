import { trpc } from '../../lib/trpc.tsx';

export function useChatReaction() {
    const utils = trpc.useUtils();
    return trpc.chat.react.useMutation({
        onSuccess: async () => {
            await utils.chat.log.list.invalidate();
        },
    });
}
