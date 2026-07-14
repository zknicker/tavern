// Mirrors the runtime's run id convention (apps/runtime/src/tavern/chat-api/ids.ts):
// one run per (message, agent seat). Matching ids let optimistic turns merge
// with the real turn events instead of lingering as ghost replies.
export function createChatRunId(messageId: string, agentId: string) {
    const messagePart = stripPrefix(messageId, 'msg_');
    const agentPart = stripPrefix(agentId, 'agt_').replace(/[^A-Za-z0-9_-]/g, '_');

    return `run_${messagePart}_${agentPart}`;
}

function stripPrefix(value: string, prefix: string) {
    return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}
