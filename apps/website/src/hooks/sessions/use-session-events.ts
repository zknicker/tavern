import { trpc } from '../../lib/trpc.tsx';

export function useSessionEvents() {
    const utils = trpc.useUtils();

    trpc.session.onUpdate.useSubscription(undefined, {
        onData: (event) => {
            const sessionKey = readStringField(event, 'sessionKey');

            void utils.session.list.invalidate();

            if (sessionKey) {
                void utils.session.get.invalidate({ sessionKey });
                void utils.session.history.get.invalidate({ sessionKey });
            } else {
                void utils.session.get.invalidate();
                void utils.session.history.get.invalidate();
            }

            void utils.session.tool.get.invalidate();
            void utils.session.log.list.invalidate();
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
