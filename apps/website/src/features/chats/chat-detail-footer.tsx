import type * as React from 'react';
import { ChatActiveStatusStack } from './chat-active-status-stack.tsx';

type ChatDetailFooterProps = Pick<
    React.ComponentProps<typeof ChatActiveStatusStack>,
    'activeReply' | 'agents' | 'rows'
> & {
    children: React.ReactNode;
};

export function ChatDetailFooter({ activeReply, agents, children, rows }: ChatDetailFooterProps) {
    return (
        <>
            <ChatActiveStatusStack
                activeReply={activeReply}
                agents={agents}
                rows={rows}
                variant="detail"
            />
            {children}
        </>
    );
}
