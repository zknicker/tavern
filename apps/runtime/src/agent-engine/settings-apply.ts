import { publishRuntimeEvent } from '../tavern/runtime-events.ts';

export function signalAgentSettingsApplied() {
    publishSettingsApplyPhase('scheduled');
    setTimeout(() => publishSettingsApplyPhase('completed'), 150);
    return true;
}

function publishSettingsApplyPhase(phase: 'completed' | 'scheduled') {
    publishRuntimeEvent({
        phase,
        timestamp: new Date().toISOString(),
        type: 'engine.restart',
    });
}
