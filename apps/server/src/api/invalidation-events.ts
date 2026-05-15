import EventEmitter, { on } from 'node:events';
import { z } from 'zod';

const invalidationEventSchema = z.object({
    emittedAt: z.string().datetime(),
});

export type InvalidationEvent = z.infer<typeof invalidationEventSchema>;

export const tavernEventNames = {
    agentUpdated: 'agent.updated',
    cronUpdated: 'cron.updated',
    jobsUpdated: 'jobs.updated',
    modelUpdated: 'model.updated',
    openRouterSettingsUpdated: 'open-router-settings.updated',
    openClawConfigUpdated: 'openclaw-config.updated',
    agentRuntimeCapabilityUpdated: 'agent-runtime-capability.updated',
    agentRuntimeUpdated: 'agent-runtime.updated',
    skillUpdated: 'skill.updated',
    syncDataUpdated: 'sync.data.updated',
    usageLiveUpdated: 'usage.live.updated',
    workersUpdated: 'workers.updated',
} as const;

export type TavernEventName = (typeof tavernEventNames)[keyof typeof tavernEventNames];

const tavernEventEmitter = new EventEmitter();

tavernEventEmitter.setMaxListeners(0);

function createInvalidationEvent(): InvalidationEvent {
    return {
        emittedAt: new Date().toISOString(),
    };
}

export function emitTavernEvent(
    eventName: TavernEventName,
    event: InvalidationEvent = createInvalidationEvent()
) {
    tavernEventEmitter.emit(eventName, event);
}

export async function* subscribeToTavernEvent(eventName: TavernEventName, signal?: AbortSignal) {
    const iterator = signal
        ? on(tavernEventEmitter, eventName, { signal })
        : on(tavernEventEmitter, eventName);

    for await (const [event] of iterator) {
        yield invalidationEventSchema.parse(event);
    }
}

export function emitAgentUpdated() {
    emitTavernEvent(tavernEventNames.agentUpdated);
}

export function emitAgentInvalidationCascade() {
    emitAgentUpdated();
    emitSyncDataUpdated();
}

export function emitSkillUpdated() {
    emitTavernEvent(tavernEventNames.skillUpdated);
}

export function emitSkillInvalidationCascade() {
    emitSkillUpdated();
    emitAgentUpdated();
    emitSyncDataUpdated();
}

export function emitSyncDataUpdated() {
    emitTavernEvent(tavernEventNames.syncDataUpdated);
}

export function emitJobsUpdated() {
    emitTavernEvent(tavernEventNames.jobsUpdated);
}

export function emitModelUpdated() {
    emitTavernEvent(tavernEventNames.modelUpdated);
}

export function emitCronUpdated() {
    emitTavernEvent(tavernEventNames.cronUpdated);
}

export function emitOpenRouterSettingsUpdated() {
    emitTavernEvent(tavernEventNames.openRouterSettingsUpdated);
}

export function emitOpenClawConfigUpdated() {
    emitTavernEvent(tavernEventNames.openClawConfigUpdated);
}

export function emitAgentRuntimeUpdated() {
    emitTavernEvent(tavernEventNames.agentRuntimeUpdated);
}

export function emitAgentRuntimeCapabilityUpdated() {
    emitTavernEvent(tavernEventNames.agentRuntimeCapabilityUpdated);
}

export function emitUsageLiveUpdated() {
    emitTavernEvent(tavernEventNames.usageLiveUpdated);
}

export function emitWorkersUpdated() {
    emitTavernEvent(tavernEventNames.workersUpdated);
}

export function emitOpenRouterSettingsInvalidationCascade() {
    emitOpenRouterSettingsUpdated();
    emitUsageLiveUpdated();
}
