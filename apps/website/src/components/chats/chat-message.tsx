'use client';

import { type HTMLMotionProps, motion } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { AttachmentGroup } from '../ui/attachment.tsx';
import { Bubble, BubbleContent } from '../ui/bubble.tsx';
import { Message, MessageContent } from '../ui/message.tsx';

export interface ChatMessageProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    animateEnter?: boolean;
    attachments?: ReactNode;
    children?: ReactNode;
    from: 'user' | 'assistant';
}

const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
    (
        {
            animateEnter = true,
            attachments,
            children,
            className,
            from,
            style,
            transition,
            ...props
        },
        ref
    ) => {
        const hasBody = children !== null && children !== undefined && children !== '';
        const hasAttachments = attachments !== null && attachments !== undefined;
        // The app owner's own messages anchor right in a secondary bubble
        // (`from="user"`); everyone else — agents and other participants —
        // reads as left-aligned plain ghost text in the roster.
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
                                <BubbleContent
                                    className={from === 'user' ? 'rounded-full px-4' : undefined}
                                >
                                    {children}
                                </BubbleContent>
                            </Bubble>
                        ) : null}
                    </MessageContent>
                </Message>
            </motion.div>
        );
    }
);

ChatMessage.displayName = 'ChatMessage';

export { ChatMessage };
