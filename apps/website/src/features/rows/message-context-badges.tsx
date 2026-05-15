import type React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import type { ChatLogOutput, SessionHistoryOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    getMessageModelContext,
    getMessageProviderContext,
    getMessageTokenContext,
} from './message-context.ts';

type ThreadMessage =
    | Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'message' }>['message']
    | Extract<SessionHistoryOutput['rows'][number], { kind: 'message' }>['message'];

export function MessageContextBadges({
    className,
    message,
    size,
}: {
    className?: string;
    message: Pick<ThreadMessage, 'metadata'>;
    size?: React.ComponentProps<typeof Badge>['size'];
}) {
    const modelContext = getMessageModelContext(message);
    const providerContext = getMessageProviderContext(message);
    const tokenContext = getMessageTokenContext(message);

    if (!(modelContext || providerContext || tokenContext)) {
        return null;
    }

    return (
        <div className={cn('flex items-center gap-1.5 whitespace-nowrap', className)}>
            {providerContext ? (
                <span className="self-center">
                    <Badge size={size} variant="secondary">
                        {providerContext.label}
                    </Badge>
                </span>
            ) : null}
            {modelContext ? (
                <span className="self-center">
                    <Badge size={size} title={modelContext.fullLabel} variant="info">
                        {modelContext.badgeLabel}
                    </Badge>
                </span>
            ) : null}
            {tokenContext?.map((stat) => (
                <span className="self-center" key={stat.label}>
                    <Badge size={size} title={stat.title} variant="subtle">
                        {stat.label} {stat.value}
                    </Badge>
                </span>
            ))}
        </div>
    );
}
