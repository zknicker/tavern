import EventEmitter, { on } from 'node:events';
import { type AgentRuntimeEvent, agentRuntimeEventSchema } from '@tavern/agent-runtime-protocol';

const agentRuntimeEventEmitter = new EventEmitter();

agentRuntimeEventEmitter.setMaxListeners(0);

export function emitObservedAgentRuntimeEvent(event: AgentRuntimeEvent) {
    agentRuntimeEventEmitter.emit('agent-runtime.event', agentRuntimeEventSchema.parse(event));
}

export async function* subscribeToObservedAgentRuntimeEvents(signal?: AbortSignal) {
    const iterator = signal
        ? on(agentRuntimeEventEmitter, 'agent-runtime.event', { signal })
        : on(agentRuntimeEventEmitter, 'agent-runtime.event');

    for await (const [event] of iterator) {
        yield agentRuntimeEventSchema.parse(event);
    }
}

async function* subscribeToObservedAgentRuntimeEventType<TType extends AgentRuntimeEvent['type']>(
    type: TType,
    signal?: AbortSignal
): AsyncGenerator<Extract<AgentRuntimeEvent, { type: TType }>> {
    for await (const event of subscribeToObservedAgentRuntimeEvents(signal)) {
        if (event.type === type) {
            yield event as Extract<AgentRuntimeEvent, { type: TType }>;
        }
    }
}

export function subscribeToObservedAgentRuntimeTurnStarted(signal?: AbortSignal) {
    return subscribeToObservedAgentRuntimeEventType('turn.started', signal);
}

export function subscribeToObservedAgentRuntimeTurnProgress(signal?: AbortSignal) {
    return subscribeToObservedAgentRuntimeEventType('turn.progress', signal);
}

export function subscribeToObservedAgentRuntimeTurnReplyUpdated(signal?: AbortSignal) {
    return subscribeToObservedAgentRuntimeEventType('turn.replyUpdated', signal);
}

export function subscribeToObservedAgentRuntimeTurnCompleted(signal?: AbortSignal) {
    return subscribeToObservedAgentRuntimeEventType('turn.completed', signal);
}

export function subscribeToObservedAgentRuntimeTurnFailed(signal?: AbortSignal) {
    return subscribeToObservedAgentRuntimeEventType('turn.failed', signal);
}
