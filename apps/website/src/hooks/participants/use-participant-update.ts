import { trpc } from '../../lib/trpc.tsx';

export function useParticipantUpdate() {
    const utils = trpc.useUtils();

    return trpc.participant.saveSettings.useMutation({
        onSuccess: async () => {
            await utils.participant.list.invalidate();
            await utils.chat.list.invalidate();
            await utils.chat.log.list.invalidate();
        },
    });
}
