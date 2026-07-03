import type * as React from 'react';
import { ChatActiveStatusStack } from './chat-active-status-stack.tsx';

type ChatDetailFooterProps = Pick<
    React.ComponentProps<typeof ChatActiveStatusStack>,
    'activeReply' | 'agents' | 'chatId' | 'rows'
> & {
    children: React.ReactNode;
};

export function ChatDetailFooter({
    activeReply,
    agents,
    chatId,
    children,
    rows,
}: ChatDetailFooterProps) {
    return (
        <>
            <ChatActiveStatusStack
                activeReply={activeReply}
                agents={agents}
                chatId={chatId}
                rows={rows}
                variant="detail"
            />
            {children}
        </>
    );
}
