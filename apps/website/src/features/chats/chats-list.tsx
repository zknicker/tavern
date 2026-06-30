import { Chat01Icon } from '@hugeicons-pro/core-duotone-rounded';
import * as React from 'react';
import { Card } from '../../components/ui/card.tsx';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../components/ui/empty.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useSearch } from '../../hooks/shell/use-search.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { ChatCard } from './chat-card.tsx';
import type { ChatListItem } from './chat-list-data.ts';
import {
    buildChatSourceFilterOptions,
    type ChatSourceFilter,
    ChatSourceFilterTabs,
} from './chat-source-filter-tabs.tsx';
import { useFocusedChatCard } from './use-focused-chat-card.ts';

export function ChatsList({
    agents,
    chats,
    onArchive,
    onEdit,
}: {
    agents: AgentListOutput['agents'];
    chats: ChatListItem[];
    onArchive: (chat: ChatListItem) => void;
    onEdit: (chat: ChatListItem) => void;
}) {
    const { deferredQuery } = useSearch();
    const [sourceFilter, setSourceFilter] = React.useState<ChatSourceFilter>('all');
    const sourceFilterOptions = React.useMemo(() => buildChatSourceFilterOptions(chats), [chats]);
    const effectiveSourceFilter = sourceFilterOptions.some((option) => option.kind === sourceFilter)
        ? sourceFilter
        : 'all';
    const visibleChats = React.useMemo(
        () =>
            chats.filter(
                (chat) =>
                    (effectiveSourceFilter === 'all' ||
                        chat.source.kind === effectiveSourceFilter) &&
                    (deferredQuery.length === 0 || chat.searchText.includes(deferredQuery))
            ),
        [chats, deferredQuery, effectiveSourceFilter]
    );
    const totalVisibleChats = visibleChats.length;
    const highlightedChatId = useFocusedChatCard(visibleChats.map((chat) => chat.id));

    if (chats.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Icon icon={Chat01Icon} />
                    </EmptyMedia>
                    <EmptyTitle>No conversations yet</EmptyTitle>
                    <EmptyDescription>
                        Start a conversation with your agent to see it here.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent />
            </Empty>
        );
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-border border-b px-4 py-2">
                <ChatSourceFilterTabs
                    filter={effectiveSourceFilter}
                    onFilterChange={setSourceFilter}
                    options={sourceFilterOptions}
                />
            </div>
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
                {totalVisibleChats > 0 ? (
                    <div className="flex h-full min-w-max items-stretch">
                        {visibleChats.map((chat) => (
                            <ChatCard
                                agents={agents}
                                chat={chat}
                                highlighted={highlightedChatId === chat.id}
                                key={chat.id}
                                onArchive={
                                    chat.framework === 'tavern' && chat.type === 'tavern'
                                        ? () => onArchive(chat)
                                        : null
                                }
                                onEdit={
                                    chat.framework === 'tavern' && chat.type === 'tavern'
                                        ? () => onEdit(chat)
                                        : null
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <div className="px-4 pt-2">
                        <Card className="max-w-xl p-6">
                            <h2 className="font-semibold text-foreground text-lg">
                                No matching chats
                            </h2>
                            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                                Try a broader search to bring shared conversations back into view.
                            </p>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
