import EventEmitter, { on } from 'node:events';
import { z } from 'zod';

const invalidationEventSchema = z
    .object({
        emittedAt: z.string().datetime(),
    })
    .passthrough();

export type InvalidationEvent = z.infer<typeof invalidationEventSchema>;

export const tavernEventNames = {
    agentInstructionsUpdated: 'agent.instructions.updated',
    agentUpdated: 'agent.updated',
    chatLogUpdated: 'chat.log.updated',
    chatUpdated: 'chat.updated',
    cronUpdated: 'cron.updated',
    engineRestartUpdated: 'engine-restart.updated',
    jobsUpdated: 'jobs.updated',
    modelUpdated: 'model.updated',
    openRouterSettingsUpdated: 'open-router-settings.updated',
    hermesConfigUpdated: 'hermes-config.updated',
    agentRuntimeCapabilityUpdated: 'agent-runtime-capability.updated',
    agentRuntimeUpdated: 'agent-runtime.updated',
    sessionUpdated: 'session.updated',
    skillUpdated: 'skill.updated',
    usageLiveUpdated: 'usage.live.updated',
    vaultUpdated: 'vault.updated',
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

export function emitEngineRestartUpdated(input: { phase: string }) {
    emitTavernEvent(tavernEventNames.engineRestartUpdated, {
        ...createInvalidationEvent(),
        phase: input.phase,
    });
}

export function emitAgentUpdated() {
    emitTavernEvent(tavernEventNames.agentUpdated);
}

export function emitAgentInstructionsUpdated(input: { agentId: string }) {
    emitTavernEvent(tavernEventNames.agentInstructionsUpdated, {
        ...createInvalidationEvent(),
        agentId: input.agentId,
    });
}

export function emitAgentInvalidationCascade() {
    emitAgentUpdated();
}

export function emitSkillUpdated() {
    emitTavernEvent(tavernEventNames.skillUpdated);
}

export function emitSkillInvalidationCascade() {
    emitSkillUpdated();
    emitAgentUpdated();
}

export function emitChatUpdated(input?: { chatId?: string }) {
    emitTavernEvent(tavernEventNames.chatUpdated, {
        ...createInvalidationEvent(),
        ...(input?.chatId ? { chatId: input.chatId } : {}),
    });
}

export function emitChatLogUpdated(input?: { chatId?: string; sessionKey?: string }) {
    emitTavernEvent(tavernEventNames.chatLogUpdated, {
        ...createInvalidationEvent(),
        ...(input?.chatId ? { chatId: input.chatId } : {}),
        ...(input?.sessionKey ? { sessionKey: input.sessionKey } : {}),
    });
}

export function emitSessionUpdated(input?: { sessionKey?: string }) {
    emitTavernEvent(tavernEventNames.sessionUpdated, {
        ...createInvalidationEvent(),
        ...(input?.sessionKey ? { sessionKey: input.sessionKey } : {}),
    });
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

export function emitHermesConfigUpdated() {
    emitTavernEvent(tavernEventNames.hermesConfigUpdated);
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

export function emitVaultUpdated(input: {
    paths?: string[];
    reason?: string;
    scope: 'content' | 'root';
    timestamp?: string;
}) {
    emitTavernEvent(tavernEventNames.vaultUpdated, {
        ...createInvalidationEvent(),
        paths: input.paths ?? [],
        reason: input.reason,
        scope: input.scope,
        timestamp: input.timestamp,
    });
}

export function emitWorkersUpdated() {
    emitTavernEvent(tavernEventNames.workersUpdated);
}

export function emitOpenRouterSettingsInvalidationCascade() {
    emitOpenRouterSettingsUpdated();
    emitUsageLiveUpdated();
}
