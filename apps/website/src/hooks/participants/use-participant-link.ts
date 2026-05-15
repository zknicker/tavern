import { trpc } from '../../lib/trpc.tsx';

export function useParticipantLink() {
    const utils = trpc.useUtils();

    return trpc.participant.link.useMutation({
        onSuccess: async () => {
            await utils.participant.list.invalidate();
            await utils.chat.list.invalidate();
            await utils.chat.log.list.invalidate();
        },
    });
}
