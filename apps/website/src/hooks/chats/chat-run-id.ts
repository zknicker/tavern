export function createChatRunId(messageId: string) {
    return `run_${stripMessagePrefix(messageId)}`;
}

function stripMessagePrefix(messageId: string) {
    return messageId.startsWith('msg_') ? messageId.slice('msg_'.length) : messageId;
}
