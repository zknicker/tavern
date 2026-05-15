export {
    createSessionSummaryMessages,
    normalizeChatHistoryMessages,
    normalizeInlineSessionMessages,
} from './message-normalize.ts';
export {
    type ChatHistoryMessage,
    deriveAgentId,
    type LiveSession,
    type LiveSessionMessage,
    normalizeSessionState,
    sessionHistoryLimit,
} from './message-shared.ts';
export { resolveSessionMessageText } from './message-text.ts';

export function getSyncErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Failed to sync stored runtime sessions.';
}
