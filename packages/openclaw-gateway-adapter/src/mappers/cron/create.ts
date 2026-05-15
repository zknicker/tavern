import type { AgentRuntimeCreateCron } from '@tavern/agent-runtime-protocol';
import { mapTavernPayloadToOpenClaw, mapTavernScheduleToOpenClaw } from './shared.ts';

export function mapTavernCronCreateToOpenClaw(input: AgentRuntimeCreateCron) {
    return {
        ...mapTavernScheduleToOpenClaw(input.schedule),
        ...mapTavernPayloadToOpenClaw(input.payload),
        agent: input.agentId ?? undefined,
        deleteAfterRun: input.deleteAfterRun,
        id: input.id,
        name: input.name,
        wake: input.wakeMode,
    };
}
