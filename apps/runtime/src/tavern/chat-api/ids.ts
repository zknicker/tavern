/**
 * The operator's participant id. Tavern is single-operator: the app always
 * authors and reads as this seat, and per-chat state that belongs to the
 * human (read receipts, unread counts) is keyed by it — chats may carry
 * additional seeded or observed user participants.
 */
export const localHumanParticipantId = 'usr_tavern';

export function createEventId(cursor: number) {
    return `evt_${cursor}`;
}

export function createAgentParticipantId(agentId: string) {
    return agentId.startsWith('agt_') ? agentId : `agt_${agentId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export function createRunId(messageId: string, agentId: string) {
    const messagePart = stripPrefix(messageId, 'msg_');
    const agentPart = stripPrefix(agentId, 'agt_').replace(/[^A-Za-z0-9_-]/g, '_');
    return `run_${messagePart}_${agentPart}`;
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
