import { trpc } from '../../lib/trpc.tsx';

export function usePaneEvents() {
    const utils = trpc.useUtils();

    trpc.pane.onUpdate.useSubscription(undefined, {
        onData: (event) => {
            const chatId = readStringField(event, 'chatId');

            if (chatId) {
                void utils.pane.get.invalidate({ chatId });
                return;
            }

            void utils.pane.get.invalidate();
        },
    });
}

function readStringField(input: unknown, field: string) {
    if (!(input && typeof input === 'object' && field in input)) {
        return null;
    }

    const value = (input as Record<string, unknown>)[field];

    return typeof value === 'string' ? value : null;
}
