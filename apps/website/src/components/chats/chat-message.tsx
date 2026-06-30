'use client';

import { type HTMLMotionProps, motion } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { AttachmentGroup } from '../ui/attachment.tsx';
import { Bubble, BubbleContent } from '../ui/bubble.tsx';
import { Message, MessageContent, MessageFooter } from '../ui/message.tsx';

export interface ChatMessageProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    actions?: ReactNode;
    animateEnter?: boolean;
    attachments?: ReactNode;
    children?: ReactNode;
    from: 'user' | 'assistant';
    time?: ReactNode;
}

const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
    (
        {
            actions,
            animateEnter = true,
            attachments,
            children,
            className,
            from,
            style,
            time,
            transition,
            ...props
        },
        ref
    ) => {
        const hasBody = children !== null && children !== undefined && children !== '';
        const hasAttachments = attachments !== null && attachments !== undefined;
        const showTime = time !== null && time !== undefined;
        const showActions = actions !== null && actions !== undefined;
        const showMeta = showTime || showActions;
        const align = from === 'user' ? 'end' : 'start';
        const bubbleVariant = from === 'user' ? 'secondary' : 'ghost';

        return (
            <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={cn('min-w-0', className)}
                data-from={from}
                initial={animateEnter ? { opacity: 0, scale: 0.96, y: 8 } : false}
                ref={ref}
                style={{
                    transformOrigin: from === 'user' ? 'bottom right' : 'bottom left',
                    ...style,
                }}
                transition={transition ?? springs.moderate}
                {...props}
            >
                <Message align={align}>
                    <MessageContent>
                        {hasAttachments ? <AttachmentGroup>{attachments}</AttachmentGroup> : null}
                        {hasBody ? (
                            <Bubble align={align} variant={bubbleVariant}>
                                <BubbleContent>{children}</BubbleContent>
                            </Bubble>
                        ) : null}
                        {showMeta ? (
                            <MessageFooter className="gap-2">
                                {showTime ? <span className="tabular-nums">{time}</span> : null}
                                {showActions ? (
                                    <span className="flex items-center gap-0.5">{actions}</span>
                                ) : null}
                            </MessageFooter>
                        ) : null}
                    </MessageContent>
                </Message>
            </motion.div>
        );
    }
);

ChatMessage.displayName = 'ChatMessage';

export { ChatMessage };
