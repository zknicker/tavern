import type { AgentRuntimeEvent } from '@tavern/api';

type RuntimeEventSubscriber = (event: AgentRuntimeEvent) => void;

const subscribers = new Set<RuntimeEventSubscriber>();

export function publishRuntimeEvent(event: AgentRuntimeEvent) {
    for (const subscriber of subscribers) {
        subscriber(event);
    }
}

export function subscribeToRuntimeEvents(subscriber: RuntimeEventSubscriber) {
    subscribers.add(subscriber);
    return () => {
        subscribers.delete(subscriber);
    };
}
