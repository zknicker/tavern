export function createEventId(cursor: number) {
    return `evt_${cursor}`;
}

export function createAgentParticipantId(agentId: string) {
    return agentId.startsWith('agt_') ? agentId : `agt_${agentId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export function createRunId(messageId: string) {
    return `run_${stripPrefix(messageId, 'msg_')}`;
}

export function assertTavernIdPrefix(
    value: string | null | undefined,
    prefix: string,
    label: string
) {
    if (typeof value === 'string' && value.startsWith(prefix)) {
        return;
    }

    throw new Error(`${label} must use a ${prefix} id.`);
}

export function assertOptionalTavernIdPrefix(
    value: string | null | undefined,
    prefix: string,
    label: string
) {
    if (value == null) {
        return;
    }

    assertTavernIdPrefix(value, prefix, label);
}

function stripPrefix(value: string, prefix: string) {
    return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}
