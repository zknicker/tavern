import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar.tsx';
import { Message, MessageContent, MessageHeader } from '../../../components/ui/message.tsx';
import { useActorProfile } from '../../../hooks/actors/use-actor.ts';
import { formatShortTime } from '../../../lib/format.ts';
import {
    ChatTranscriptMessageContent,
    renderTranscriptMessageAttachments,
} from '../chat-transcript-message.tsx';
import type { TranscriptMessageRow } from '../chat-transcript-render-context.tsx';

export function ThreadAnchorMessage({ row }: { row: TranscriptMessageRow }) {
    const actor = useActorProfile(row.actor);
    const displayName = actor?.name ?? row.message.sender ?? 'Unknown';

    return (
        <div className="pt-4 pb-3">
            <Message align="start" className="gap-3">
                <Avatar className="mt-1 size-10 rounded-lg">
                    {actor?.avatarUrl ? (
                        <AvatarImage alt={`${displayName} avatar`} src={actor.avatarUrl} />
                    ) : null}
                    <AvatarFallback className="bg-brand-muted text-brand-muted-foreground">
                        {getInitials(displayName)}
                    </AvatarFallback>
                </Avatar>
                <MessageContent className="gap-0 pt-0.5">
                    <MessageHeader className="gap-2 px-0">
                        <span className="font-semibold text-foreground text-sm">{displayName}</span>
                        <time
                            className="text-meta text-muted-foreground"
                            dateTime={row.message.timestamp}
                        >
                            {formatShortTime(row.message.timestamp)}
                        </time>
                    </MessageHeader>
                    <div className="-mt-0.5 min-w-0">
                        <ChatTranscriptMessageContent message={row.message} />
                        {renderTranscriptMessageAttachments(row.message.attachments)}
                    </div>
                </MessageContent>
            </Message>
        </div>
    );
}

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/u);
    return `${parts[0]?.[0] ?? '?'}${parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : ''}`.toUpperCase();
}
