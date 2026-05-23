import * as React from 'react';
import { trpc } from '../../lib/trpc.tsx';

const syncInvalidationDebounceMs = 250;

export function useSyncEvents() {
    const utils = trpc.useUtils();
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(
        () => () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        },
        []
    );

    trpc.sync.onDataUpdate.useSubscription(undefined, {
        onData: () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = null;

                Promise.all([
                    utils.agent.activity.invalidate(),
                    utils.chat.get.invalidate(),
                    utils.chat.list.invalidate(),
                    utils.chat.log.list.invalidate(),
                    utils.log.list.invalidate(),
                    utils.cron.deliveryTargets.invalidate(),
                    utils.session.get.invalidate(),
                    utils.session.list.invalidate(),
                    utils.session.history.get.invalidate(),
                    utils.session.tool.get.invalidate(),
                    utils.subAgent.list.invalidate(),
                ]).catch(() => undefined);
            }, syncInvalidationDebounceMs);
        },
    });
}
