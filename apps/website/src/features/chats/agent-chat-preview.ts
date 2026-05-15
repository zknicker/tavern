import { formatShortTime, truncate } from '../../lib/format.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { getMessageDisplay } from '../rows/message-display.ts';

type ChatLogRow = NonNullable<ChatLogOutput>['rows'][number];
type ChatLogMessageRow = Extract<ChatLogRow, { kind: 'message' }>;

export interface AgentChatPreviewLine {
    actor: ChatLogMessageRow['actor'];
    content: string;
    id: string;
    sender: string;
    senderType: 'agent' | 'system' | 'user';
    timeLabel: string;
}

export function buildAgentChatPreview(rows: ChatLogRow[], limit = 4): AgentChatPreviewLine[] {
    return rows
        .filter((row): row is Extract<ChatLogRow, { kind: 'message' }> => row.kind === 'message')
        .map((row) => {
            const display = getMessageDisplay(row.message);
            const trimmedContent = display.content.replace(/\s+/g, ' ').trim();

            if (trimmedContent.length === 0) {
                return null;
            }

            const senderType: AgentChatPreviewLine['senderType'] =
                row.message.senderType === 'agent'
                    ? 'agent'
                    : row.message.senderType === 'user'
                      ? 'user'
                      : 'system';

            return {
                actor: row.actor,
                content: truncate(trimmedContent, 72),
                id: row.id,
                sender: row.message.sender,
                senderType,
                timeLabel: formatShortTime(row.message.timestamp),
            };
        })
        .flatMap((line) => (line ? [line] : []))
        .slice(-limit);
}
