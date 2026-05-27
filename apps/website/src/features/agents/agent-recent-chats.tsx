import * as React from 'react';
import { useAgentChatListSuspense } from '../../hooks/agents/use-agent-chats.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { AgentChatCard } from '../chats/agent-chat-card.tsx';
import { buildChatList } from '../chats/chat-list-data.ts';
import {
    buildChatSourceFilterOptions,
    type ChatSourceFilter,
    ChatSourceFilterTabs,
} from '../chats/chat-source-filter-tabs.tsx';

export function AgentRecentChats({ agent }: { agent: AgentListOutput['agents'][number] }) {
    const [chatData] = useAgentChatListSuspense({ agentId: agent.id });
    const [sourceFilter, setSourceFilter] = React.useState<ChatSourceFilter>('all');
    const chats = React.useMemo(() => buildChatList(chatData), [chatData]);
    const agentChats = chats;
    const sourceFilterOptions = React.useMemo(
        () => buildChatSourceFilterOptions(agentChats),
        [agentChats]
    );
    const effectiveSourceFilter = sourceFilterOptions.some((option) => option.kind === sourceFilter)
        ? sourceFilter
        : 'all';
    const visibleAgentChats = React.useMemo(
        () =>
            agentChats.filter(
                (chat) =>
                    effectiveSourceFilter === 'all' || chat.source.kind === effectiveSourceFilter
            ),
        [agentChats, effectiveSourceFilter]
    );
    return (
        <section>
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-medium text-muted-foreground text-sm">Recent chats</h2>
            </div>

            {agentChats.length > 0 ? (
                <>
                    <div className="mt-3">
                        <ChatSourceFilterTabs
                            filter={effectiveSourceFilter}
                            onFilterChange={setSourceFilter}
                            options={sourceFilterOptions}
                        />
                    </div>
                    {visibleAgentChats.length > 0 ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleAgentChats.map((chat) => (
                                <AgentChatCard
                                    chat={chat}
                                    hasActiveReply={false}
                                    highlighted={false}
                                    key={chat.id}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="mt-3 rounded-xl border border-border border-dashed px-4 py-5">
                            <h3 className="font-medium text-foreground text-sm">
                                No matching chats
                            </h3>
                            <p className="mt-1 text-muted-foreground text-sm">
                                Select All to bring {agent.name}&apos;s synced chats back into view.
                            </p>
                        </div>
                    )}
                </>
            ) : (
                <div className="mt-3 rounded-xl border border-border border-dashed px-4 py-5">
                    <h3 className="font-medium text-foreground text-sm">No synced chats yet</h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Tavern, Discord, and other synced runtime chats for {agent.name} will show
                        here.
                    </p>
                </div>
            )}
        </section>
    );
}
