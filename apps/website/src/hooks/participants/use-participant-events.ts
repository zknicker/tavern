import { trpc } from '../../lib/trpc.tsx';

export function useParticipantEvents() {
    const utils = trpc.useUtils();

    trpc.participant.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.participant.list.invalidate();
            void utils.chat.get.invalidate();
            void utils.chat.list.invalidate();
        },
    });
}
