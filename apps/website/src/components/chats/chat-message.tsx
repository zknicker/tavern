'use client';

import { type HTMLMotionProps, motion } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';

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
        { actions, animateEnter = true, attachments, children, className, from, time, ...props },
        ref
    ) => {
        const isUser = from === 'user';
        const hasBody = children !== null && children !== undefined && children !== '';
        const hasAttachments = attachments !== null && attachments !== undefined;
        const showTime = isUser && time !== null && time !== undefined;
        const showActions = actions !== null && actions !== undefined;
        const showMeta = showTime || showActions;

        return (
            <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={cn(
                    'group relative flex max-w-[80%] flex-col gap-1.5',
                    isUser ? 'items-end self-end' : 'items-start self-start',
                    className
                )}
                initial={animateEnter ? { opacity: 0, scale: 0.96, y: 8 } : false}
                ref={ref}
                style={{ transformOrigin: isUser ? 'bottom right' : 'bottom left' }}
                transition={springs.moderate}
                {...props}
            >
                {hasAttachments ? (
                    <div
                        className={cn(
                            'flex flex-wrap gap-1.5',
                            isUser ? 'justify-end' : 'justify-start'
                        )}
                    >
                        {attachments}
                    </div>
                ) : null}
                {hasBody ? (
                    <div
                        className={cn(
                            'whitespace-pre-wrap break-words text-sm',
                            isUser
                                ? 'text-pretty rounded-[20px] bg-[color-mix(in_oklab,var(--accent),var(--background)_45%)] px-3.5 py-2 text-accent-foreground'
                                : 'min-h-5 text-foreground'
                        )}
                    >
                        {children}
                    </div>
                ) : null}
                {showMeta ? (
                    <div
                        className={cn(
                            'pointer-events-none absolute top-full z-10 mt-1 flex select-none items-center gap-2 px-1 text-muted-foreground text-xs leading-none opacity-0 transition-opacity duration-150',
                            isUser ? 'right-0' : 'left-0',
                            'group-hover:pointer-events-auto group-hover:opacity-100',
                            'group-has-focus-visible:pointer-events-auto group-has-focus-visible:opacity-100'
                        )}
                    >
                        {showTime ? <span className="tabular-nums">{time}</span> : null}
                        {showActions ? (
                            <span className="flex items-center gap-0.5">{actions}</span>
                        ) : null}
                    </div>
                ) : null}
            </motion.div>
        );
    }
);

ChatMessage.displayName = 'ChatMessage';

export { ChatMessage };
