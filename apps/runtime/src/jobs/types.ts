import type { AgentRuntimeCapabilityHealthId, AgentRuntimeJobSlug } from '@tavern/api';

export type RuntimeJobTrigger = 'manual' | 'schedule' | 'startup' | 'unknown' | 'write';

export type RuntimeJobRunState =
    | 'active'
    | 'completed'
    | 'delayed'
    | 'failed'
    | 'unknown'
    | 'waiting';

export interface RuntimeJobQueuePayload {
    input: Record<string, unknown>;
    trigger: RuntimeJobTrigger;
}

export interface RuntimeJobSchedule {
    everyMs: number;
    kind: 'interval';
    runOnStart: boolean;
}

export interface RuntimeJobContext {
    input: Record<string, unknown>;
    log(message: string): Promise<void>;
    trigger: RuntimeJobTrigger;
}

export interface RuntimeJobDefinition {
    concurrency: number;
    defaultInput: Record<string, unknown>;
    description: string;
    disabledReason(): Promise<string | null> | string | null;
    displayName: string;
    requiredCapabilities?: AgentRuntimeCapabilityHealthId[];
    run(context: RuntimeJobContext): Promise<void>;
    schedule: RuntimeJobSchedule;
    slug: AgentRuntimeJobSlug;
}
