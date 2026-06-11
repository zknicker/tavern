import { useEffect, useRef } from 'react';
import { toastManager } from '../../components/ui/toast.tsx';
import { trpc } from '../../lib/trpc.tsx';

const restartTimeoutMs = 120_000;

export type EngineRestartToastAction = 'complete' | 'ignore' | 'start';

/**
 * One promise toast per engine restart cycle: settings saves that need a
 * restart raise it ("Applying settings…"), and it resolves when the engine
 * reports the restart completed. Bursts share a single toast, matching the
 * restart coordinator's coalescing.
 */
export function useEngineRestartToast() {
    const pending = useRef<{ fail: (error: Error) => void; finish: () => void } | null>(null);

    useEffect(
        () => () => {
            pending.current?.finish();
            pending.current = null;
        },
        []
    );

    trpc.agent.onEngineRestart.useSubscription(undefined, {
        onData: (event) => {
            const phase = typeof event.phase === 'string' ? event.phase : '';
            const action = engineRestartToastAction(pending.current !== null, phase);

            if (action === 'complete') {
                pending.current?.finish();
                pending.current = null;
                return;
            }
            if (action !== 'start') {
                return;
            }

            let resolve!: () => void;
            let reject!: (error: Error) => void;
            const promise = new Promise<void>((res, rej) => {
                resolve = res;
                reject = rej;
            });
            const timeout = setTimeout(() => {
                if (pending.current) {
                    pending.current = null;
                    reject(
                        new Error('The agent engine is taking longer than expected to restart.')
                    );
                }
            }, restartTimeoutMs);
            pending.current = {
                fail: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                },
                finish: () => {
                    clearTimeout(timeout);
                    resolve();
                },
            };

            void toastManager
                .promise(promise, {
                    error: {
                        description: 'Your settings will apply when it finishes.',
                        title: 'The agent engine is still restarting',
                    },
                    loading: {
                        description: 'Restarting the agent engine…',
                        title: 'Applying settings',
                    },
                    success: { title: 'Settings applied' },
                })
                .catch(() => undefined);
        },
    });
}

/** Pure phase handling: one toast per cycle, completed resolves it. */
export function engineRestartToastAction(
    hasPendingToast: boolean,
    phase: string
): EngineRestartToastAction {
    if (phase === 'completed') {
        return hasPendingToast ? 'complete' : 'ignore';
    }
    if (phase === 'scheduled' || phase === 'restarting') {
        return hasPendingToast ? 'ignore' : 'start';
    }
    return 'ignore';
}
