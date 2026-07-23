import * as React from 'react';
import { trpc } from '../../lib/trpc.tsx';

export interface ChatComposition {
    agentId: string;
    state: 'composing' | 'retracted';
    target: string;
    text: string;
    updatedAt: number;
}

// Ephemeral composition stream (specs/chat-timeline.md): a provisional
// bubble for an in-flight `grotto message send`, never persisted, never
// replayed on reconnect. A composition drops when the agent retracts it,
// when the durable message with a matching compositionId lands (the caller
// reports that via dropComposition), or after this TTL without an update —
// covering a crash or abandoned send the agent never resolves.
const compositionTtlMs = 12_000;
const sweepIntervalMs = 3000;

export function useChatCompositions() {
    const [compositions, setCompositions] = React.useState<ReadonlyMap<string, ChatComposition>>(
        () => new Map()
    );

    trpc.chat.onComposition.useSubscription(undefined, {
        onData: (event) => {
            setCompositions((current) => {
                const next = new Map(current);

                if (event.state === 'retracted') {
                    next.delete(event.compositionId);
                } else {
                    next.set(event.compositionId, {
                        agentId: event.agentId,
                        state: event.state,
                        target: event.target,
                        text: event.text,
                        updatedAt: Date.now(),
                    });
                }

                return next;
            });
        },
    });

    React.useEffect(() => {
        const interval = setInterval(() => {
            setCompositions((current) => {
                const now = Date.now();
                const stale = [...current].filter(
                    ([, composition]) => now - composition.updatedAt >= compositionTtlMs
                );

                if (stale.length === 0) {
                    return current;
                }

                const next = new Map(current);
                for (const [id] of stale) {
                    next.delete(id);
                }
                return next;
            });
        }, sweepIntervalMs);

        return () => clearInterval(interval);
    }, []);

    const dropComposition = React.useCallback((compositionId: string) => {
        setCompositions((current) => {
            if (!current.has(compositionId)) {
                return current;
            }

            const next = new Map(current);
            next.delete(compositionId);
            return next;
        });
    }, []);

    return { compositions, dropComposition };
}
