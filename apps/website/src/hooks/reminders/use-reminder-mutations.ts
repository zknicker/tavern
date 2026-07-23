import { trpc } from '../../lib/trpc.tsx';

export function useReminderCancel() {
    const utils = trpc.useUtils();
    return trpc.reminder.cancel.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.reminder.list.invalidate(), utils.reminder.runs.invalidate()]);
        },
    });
}
