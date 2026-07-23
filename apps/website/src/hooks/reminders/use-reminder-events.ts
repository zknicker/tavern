import { trpc } from '../../lib/trpc.tsx';

export function useReminderEvents() {
    const utils = trpc.useUtils();
    trpc.reminder.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.reminder.list.invalidate();
            void utils.reminder.runs.invalidate();
        },
    });
}
