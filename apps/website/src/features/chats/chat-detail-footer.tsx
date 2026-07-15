import type * as React from 'react';
import { AgentBusyElsewhereHint } from './agent-presence.tsx';
import { ChatActiveStatusStack } from './chat-active-status-stack.tsx';
import type { ChatListItem } from './chat-list-data.ts';

type ChatDetailFooterProps = Pick<
    React.ComponentProps<typeof ChatActiveStatusStack>,
    'activeReplies' | 'agents' | 'chatId' | 'rows' | 'turnEvidence'
> & {
    chat?: ChatListItem;
    children: React.ReactNode;
};

export function ChatDetailFooter({
    activeReplies,
    agents,
    chat,
    chatId,
    children,
    rows,
    turnEvidence,
}: ChatDetailFooterProps) {
    return (
        <div className="relative">
            {/* Floats over the transcript's reserved bottom padding: status
                rows appearing or disappearing never change layout or scroll
                position. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-full z-10">
                <ChatActiveStatusStack
                    activeReplies={activeReplies}
                    agents={agents}
                    chatId={chatId}
                    className="pointer-events-auto"
                    rows={rows}
                    turnEvidence={turnEvidence}
                    variant="detail"
                />
            </div>
            {chat ? (
                <AgentBusyElsewhereHint
                    activeReplies={activeReplies}
                    boundAgentIds={chat.boundAgentIds}
                    chat={chat}
                />
            ) : null}
            {children}
        </div>
    );
}
