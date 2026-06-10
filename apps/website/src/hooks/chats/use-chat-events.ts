import { trpc } from '../../lib/trpc.tsx';

export function useChatEvents() {
    const utils = trpc.useUtils();

    trpc.chat.onUpdate.useSubscription(undefined, {
        onData: (event) => {
            const chatId = readStringField(event, 'chatId');

            void utils.chat.list.invalidate();

            if (chatId) {
                void utils.chat.get.invalidate({ chatId });
                return;
            }

            void utils.chat.get.invalidate();
        },
    });

    trpc.chat.log.onUpdate.useSubscription(undefined, {
        onData: (event) => {
            const chatId = readStringField(event, 'chatId');

            if (chatId) {
                void utils.chat.log.list.invalidate({ id: chatId });
                return;
            }

            void utils.chat.log.list.invalidate();
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
