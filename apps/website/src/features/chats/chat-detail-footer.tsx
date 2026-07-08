import type * as React from 'react';
import { ChatActiveStatusStack } from './chat-active-status-stack.tsx';

type ChatDetailFooterProps = Pick<
    React.ComponentProps<typeof ChatActiveStatusStack>,
    'activeReplies' | 'agents' | 'chatId' | 'rows' | 'turnEvidence'
> & {
    children: React.ReactNode;
};

export function ChatDetailFooter({
    activeReplies,
    agents,
    chatId,
    children,
    rows,
    turnEvidence,
}: ChatDetailFooterProps) {
    return (
        <>
            <ChatActiveStatusStack
                activeReplies={activeReplies}
                agents={agents}
                chatId={chatId}
                rows={rows}
                turnEvidence={turnEvidence}
                variant="detail"
            />
            {children}
        </>
    );
}
