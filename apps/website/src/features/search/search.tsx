import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import { useTaskList } from '../../hooks/tasks/use-task-list.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { AgentOptionLabel } from '../agents/agent-option-label.tsx';
import { buildChatList } from '../chats/chat-list-data.ts';
import { getInitials, getUserDisplayName } from '../members/human-member-list.tsx';
import { buildSidebarChatGroups, getSidebarChatTitle } from '../shell/sidebar-chat-list-model.ts';
import { formatTaskNumber } from '../tasks/task-presentation.ts';
import { SearchChatIcon } from './search-chat-icon.tsx';

export function Search() {
    const [query, setQuery] = React.useState('');
    const chatsQuery = useChatList();
    const agentsQuery = useAgentList();
    const tasksQuery = useTaskList();
    const normalizedQuery = query.trim().toLowerCase();
    const chatGroups = buildSidebarChatGroups(buildChatList(chatsQuery.data));
    const channels = chatGroups.channels.filter((chat) =>
        getSidebarChatTitle(chat).toLowerCase().includes(normalizedQuery)
    );
    const directMessages = chatGroups.directMessages.filter((chat) =>
        getSidebarChatTitle(chat).toLowerCase().includes(normalizedQuery)
    );
    const agents = (agentsQuery.data?.agents ?? []).filter((agent) =>
        `${agent.name}\n${agent.bio ?? ''}`.toLowerCase().includes(normalizedQuery)
    );
    const tasks = (tasksQuery.data?.tasks ?? []).filter((task) =>
        `${formatTaskNumber(task)}\n${task.title}`.toLowerCase().includes(normalizedQuery)
    );
    const membersQuery = trpc.identity.members.useQuery(undefined, { enabled: isClerkEnabled });
    const people = (membersQuery.data?.members ?? [])
        .map((member) => member.user)
        .filter((user) =>
            `${getUserDisplayName(user)}\n${user.email ?? ''}`
                .toLowerCase()
                .includes(normalizedQuery)
        );
    const hasResults =
        channels.length > 0 ||
        directMessages.length > 0 ||
        agents.length > 0 ||
        people.length > 0 ||
        tasks.length > 0;

    return (
        <main className="min-h-0 flex-1 overflow-y-auto px-8 py-12">
            <div className="mx-auto w-full max-w-2xl">
                <SearchInput
                    aria-label="Search everything"
                    autoFocus
                    className="[&_[data-slot=input-control]]:h-12 [&_[data-slot=input]]:text-base"
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search everything..."
                    value={query}
                />
                {normalizedQuery.length === 0 ? (
                    <SearchEmpty />
                ) : hasResults ? (
                    <div className="mt-8 space-y-7">
                        <ChatResults chats={channels} label="Channels" />
                        <ChatResults chats={directMessages} label="Direct messages" />
                        <SearchGroup label="Agents">
                            {agents.map((agent) => (
                                <SearchRow key={agent.id} to={appRoutes.memberAgent(agent.id)}>
                                    <div className="min-w-0">
                                        <AgentOptionLabel
                                            agent={{
                                                character: agent.effectiveCharacter,
                                                id: agent.id,
                                                name: agent.name,
                                                primaryColor: agent.effectivePrimaryColor,
                                            }}
                                        />
                                        {agent.bio ? (
                                            <p className="truncate pl-6.5 text-muted-foreground text-sm">
                                                {agent.bio}
                                            </p>
                                        ) : null}
                                    </div>
                                </SearchRow>
                            ))}
                        </SearchGroup>
                        <SearchGroup label="People">
                            {people.map((user) => {
                                const name = getUserDisplayName(user);
                                return (
                                    <SearchRow key={user.id} to={appRoutes.membersHumans}>
                                        <Avatar className="size-5">
                                            {user.avatarUrl ? (
                                                <AvatarImage
                                                    alt={`${name} avatar`}
                                                    src={user.avatarUrl}
                                                />
                                            ) : null}
                                            <AvatarFallback className="text-[10px]">
                                                {getInitials(name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="min-w-0 truncate">{name}</span>
                                        {user.email ? (
                                            <span className="min-w-0 truncate text-muted-foreground">
                                                {user.email}
                                            </span>
                                        ) : null}
                                    </SearchRow>
                                );
                            })}
                        </SearchGroup>
                        <SearchGroup label="Tasks">
                            {tasks.map((task) => (
                                <SearchRow key={task.id} to={appRoutes.task(task.id)}>
                                    <span className="w-14 shrink-0 font-mono text-meta text-muted-foreground">
                                        {formatTaskNumber(task)}
                                    </span>
                                    <span className="min-w-0 truncate">{task.title}</span>
                                </SearchRow>
                            ))}
                        </SearchGroup>
                    </div>
                ) : (
                    <p className="py-24 text-center text-muted-foreground text-sm">
                        No results for &quot;{query.trim()}&quot;
                    </p>
                )}
            </div>
        </main>
    );
}

function ChatResults({ chats, label }: { chats: ReturnType<typeof buildChatList>; label: string }) {
    return (
        <SearchGroup label={label}>
            {chats.map((chat) => (
                <SearchRow key={chat.id} to={appRoutes.chat(chat.id)}>
                    <SearchChatIcon chat={chat} />
                    <span className="min-w-0 truncate">{getSidebarChatTitle(chat)}</span>
                </SearchRow>
            ))}
        </SearchGroup>
    );
}

function SearchGroup({ children, label }: { children: React.ReactNode; label: string }) {
    if (React.Children.count(children) === 0) {
        return null;
    }

    return (
        <section>
            <h2 className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wider">
                {label}
            </h2>
            <div className="space-y-1">{children}</div>
        </section>
    );
}

function SearchRow({ children, to }: { children: React.ReactNode; to: string }) {
    return (
        <Link
            className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted"
            to={to}
        >
            {children}
        </Link>
    );
}

function SearchEmpty() {
    return (
        <div className="flex flex-col items-center py-24 text-center">
            <Icon aria-hidden="true" className="size-8 text-muted-foreground" icon={Search01Icon} />
            <h1 className="mt-4 font-semibold text-sm">Search everything</h1>
            <p className="mt-1 text-muted-foreground text-sm">
                Search channels, DMs, people, agents, and tasks.
            </p>
        </div>
    );
}
