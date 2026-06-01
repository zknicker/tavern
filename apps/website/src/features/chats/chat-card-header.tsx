import { getChatDisplayTitle } from '../../components/chats/chat-display.ts';
import { ChatTitle } from '../../components/chats/chat-title.tsx';
import { ChatTypeBadge } from '../../components/chats/chat-type-badge.tsx';
import { AgentAvatar } from '../../components/ui/agent-avatar.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip.tsx';
import type { DashboardAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import type { ChatListItem } from './chat-list-data.ts';

export function ChatCardHeader({
    avatarDirectory,
    chat,
    onArchive,
    onEdit,
}: {
    avatarDirectory: DashboardAvatarDirectory;
    chat: ChatListItem;
    onArchive?: (() => void) | null;
    onEdit?: (() => void) | null;
}) {
    const title = getChatDisplayTitle(chat);

    return (
        <div className="border-border border-b bg-chrome">
            <div className="flex items-center gap-3 px-3 py-4">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <h2
                                className="min-w-0 truncate font-semibold text-foreground text-lg leading-none tracking-tight"
                                title={title}
                            >
                                <ChatTitle chat={chat} />
                            </h2>
                            <ChatTypeBadge
                                chat={chat}
                                className="shrink-0 self-center"
                                showDetail={false}
                            />
                        </div>
                        {chat.latestSession?.sessionKey ? (
                            <p
                                className="mt-1 truncate font-mono text-muted-foreground/65 text-xs"
                                title={chat.latestSession.sessionKey}
                            >
                                {chat.latestSession.sessionKey}
                            </p>
                        ) : null}
                    </div>
                    {chat.isDisabled ? <Badge variant="secondary">Disabled</Badge> : null}
                </div>
                {chat.participants.length > 0 ? (
                    <div className="ml-auto flex shrink-0 items-center -space-x-1 self-start leading-none">
                        {chat.participants.map((participant) => {
                            const resolved =
                                participant.actorType === 'agent'
                                    ? avatarDirectory.get(participant.actorId ?? participant.name)
                                    : {
                                          avatar: participant.avatar ?? participant.name,
                                          backgroundColor: participant.primaryColor ?? '#64748b',
                                      };
                            return (
                                <Tooltip
                                    key={`${chat.id}:${participant.actorType}:${participant.actorId}`}
                                >
                                    <TooltipTrigger
                                        render={
                                            <span className="flex items-center self-center">
                                                <AgentAvatar
                                                    avatar={resolved.avatar}
                                                    backgroundColor={resolved.backgroundColor}
                                                    className="size-5 self-center ring-1 ring-chrome"
                                                    name={participant.name}
                                                />
                                            </span>
                                        }
                                    />
                                    <TooltipContent side="bottom">
                                        {participant.name}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                ) : null}
                {onEdit || onArchive ? (
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                        {onEdit ? (
                            <Button onClick={onEdit} size="sm" type="button" variant="ghost">
                                Edit
                            </Button>
                        ) : null}
                        {onArchive ? (
                            <Button onClick={onArchive} size="sm" type="button" variant="ghost">
                                Archive
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {chat.agentRuntimeSyncLabel ? (
                <div className="border-border/70 border-t px-3 py-2 text-muted-foreground text-xs">
                    {chat.agentRuntimeSyncLabel}
                </div>
            ) : null}
        </div>
    );
}
