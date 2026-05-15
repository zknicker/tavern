import EventEmitter from 'node:events';
import type { RuntimeEvent } from '@tavern/agent-runtime-protocol';
import { runtimeEventSchema } from '@tavern/agent-runtime-protocol';

const emitter = new EventEmitter();

emitter.setMaxListeners(0);

export function emitTavernRuntimeEvent(event: RuntimeEvent): void {
    emitter.emit('runtime.event', runtimeEventSchema.parse(event));
}

export function subscribeToTavernRuntimeEvents(listener: (event: RuntimeEvent) => void) {
    emitter.on('runtime.event', listener);

    return () => {
        emitter.off('runtime.event', listener);
    };
}
