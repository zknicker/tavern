import type { AgentRuntimeUpdateCron } from '@tavern/agent-runtime-protocol';
import { mapTavernPayloadToOpenClaw, mapTavernScheduleToOpenClaw } from './shared.ts';

export function mapTavernCronUpdateToOpenClaw(input: AgentRuntimeUpdateCron) {
    return {
        ...(input.schedule ? mapTavernScheduleToOpenClaw(input.schedule) : {}),
        ...(input.payload ? mapTavernPayloadToOpenClaw(input.payload) : {}),
        agent: input.agentId ?? undefined,
        deleteAfterRun: input.deleteAfterRun,
        enabled: input.enabled,
        name: input.name,
        wake: input.wakeMode,
    };
}
