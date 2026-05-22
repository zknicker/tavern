import * as React from 'react';
import { DayDivider, formatDayLabel } from '../../components/ui/day-divider.tsx';
import type {
    ChatActiveReply,
    ChatCompletedProgress,
    ChatTurnFailure,
    ChatTurnProgressStep,
} from '../../hooks/chats/chat-timeline-state.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import {
    buildTranscriptEntries,
    type ConversationMessageLayout,
    getItemSessionKey,
    type TranscriptEntry,
    type TranscriptRow,
} from './chat-transcript-model.ts';
import { TranscriptEntryView } from './chat-transcript-turn.tsx';

const directConversationMessageLayout: ConversationMessageLayout = {
    showAgentIdentity: false,
    showHumanIdentity: false,
};

export function ChatTranscript({
    activeReply,
    activeReplyProgressStartedAt = null,
    activeReplySteps = [],
    chatId,
    completedProgress = null,
    conversationLayout = directConversationMessageLayout,
    currentSessionKey,
    failedTurn = null,
    rows,
}: {
    activeReply: ChatActiveReply | null;
    activeReplyProgressStartedAt?: string | null;
    activeReplySteps?: ChatTurnProgressStep[];
    chatId?: string;
    completedProgress?: ChatCompletedProgress | null;
    conversationLayout?: ConversationMessageLayout;
    currentSessionKey?: string | null;
    failedTurn?: ChatTurnFailure | null;
    rows: TranscriptRow[];
}) {
    const entries = React.useMemo(
        () =>
            buildTranscriptEntries({
                activeReply,
                activeReplyProgressStartedAt,
                activeReplySteps,
                completedProgress,
                failedTurn,
                rows,
            }),
        [
            activeReply,
            activeReplyProgressStartedAt,
            activeReplySteps,
            completedProgress,
            failedTurn,
            rows,
        ]
    );
    const latestAgentMessage = React.useMemo(() => getLatestAgentMessage(rows), [rows]);

    React.useEffect(() => {
        if (!activeReply) {
            return;
        }

        markChatTiming('thinking-visible', {
            runId: activeReply.runId,
            sessionKey: activeReply.sessionKey,
        });
    }, [activeReply]);

    React.useEffect(() => {
        if (!(activeReply && activeReplySteps.length > 0)) {
            return;
        }

        markChatTiming('working-visible', {
            runId: activeReply.runId,
            sessionKey: activeReply.sessionKey,
            stepCount: activeReplySteps.length,
        });
    }, [activeReply, activeReplySteps.length]);

    React.useEffect(() => {
        if (!latestAgentMessage) {
            return;
        }

        markChatTiming('final-message-visible', {
            messageId: latestAgentMessage.id,
            sessionKey: latestAgentMessage.sourceSessionKey,
        });
    }, [latestAgentMessage]);

    let previousDayKey: string | null = null;

    return (
        <>
            {entries.map((entry, index) => {
                const previousEntry = index > 0 ? entries[index - 1] : null;
                const timestamp = entry.timestamp;
                const dayKey = getDayKey(timestamp);
                const showDayDivider = dayKey !== null && dayKey !== previousDayKey;
                const turnStartedAt = getAgentTurnStartedAt(previousEntry, entry);

                if (dayKey !== null) {
                    previousDayKey = dayKey;
                }

                return (
                    <React.Fragment key={entry.id}>
                        {showDayDivider && timestamp ? (
                            <DayDivider
                                className="mx-3 mt-3 mb-1"
                                label={formatDayLabel(timestamp)}
                            />
                        ) : null}
                        <TranscriptEntryView
                            chatId={chatId}
                            conversationLayout={conversationLayout}
                            currentSessionKey={currentSessionKey}
                            entry={entry}
                            turnStartedAt={turnStartedAt}
                        />
                    </React.Fragment>
                );
            })}
        </>
    );
}

function getDayKey(timestamp: string | null) {
    if (!timestamp) {
        return null;
    }

    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getLatestAgentMessage(rows: TranscriptRow[]) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (row?.kind === 'message' && row.message.senderType === 'agent') {
            return row.message;
        }
    }

    return null;
}

function getAgentTurnStartedAt(
    previousEntry: TranscriptEntry | null,
    entry: TranscriptEntry
): string | null {
    if (
        entry.kind !== 'turn' ||
        entry.participant !== 'agent' ||
        previousEntry?.kind !== 'turn' ||
        previousEntry.participant !== 'user'
    ) {
        return null;
    }

    const agentSessionKey = getEntrySessionKey(entry);
    const userSessionKey = getEntrySessionKey(previousEntry);

    return agentSessionKey && agentSessionKey === userSessionKey ? previousEntry.timestamp : null;
}

function getEntrySessionKey(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    for (const item of entry.items) {
        const sessionKey = getItemSessionKey(item);

        if (sessionKey) {
            return sessionKey;
        }
    }

    return null;
}
