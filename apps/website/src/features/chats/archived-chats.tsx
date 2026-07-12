import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { useArchivedChatListSuspense } from '../../hooks/chats/use-chat-list.ts';
import { useChatUnarchive } from '../../hooks/chats/use-chat-unarchive.ts';
import { getChannelColorStyle } from '../shell/channel-color-options.ts';
import { EmptyState } from '../shell/empty-state.tsx';
import { buildArchivedChatGroups } from './archived-chats-model.ts';
import { buildChatList, type ChatListItem, getChatLastActivityLabel } from './chat-list-data.ts';
import { buildChatPath } from './chat-path.ts';

export function ArchivedChats() {
    const [chatData] = useArchivedChatListSuspense();
    const unarchiveChat = useChatUnarchive();
    const relativeNow = useRelativeNow();
    const chats = React.useMemo(() => buildChatList(chatData), [chatData]);
    const groups = buildArchivedChatGroups(chats);
    const restoringChatId = unarchiveChat.isPending
        ? (unarchiveChat.variables?.chatId ?? null)
        : null;

    return (
        <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-6 py-8">
                <header className="pb-6">
                    <h1 className="font-semibold text-base text-foreground">Archived chats</h1>
                    <p className="pt-1 text-muted-foreground text-sm">
                        Archived chats keep their history. Restore one to bring it back.
                    </p>
                </header>
                {unarchiveChat.error ? (
                    <div className="mb-4 rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-error text-sm">
                        {unarchiveChat.error.message}
                    </div>
                ) : null}
                {groups.length === 0 ? (
                    <EmptyState
                        description="Archive a channel from its sidebar menu and it will move here, history intact."
                        title="No archived chats"
                    />
                ) : (
                    <div className="flex flex-col gap-6">
                        {groups.map((group) => (
                            <section key={group.key}>
                                <BadgeDivider className="pb-2">{group.label}</BadgeDivider>
                                <ul className="flex flex-col">
                                    {group.chats.map((chat) => (
                                        <ArchivedChatRow
                                            chat={chat}
                                            isRestoring={restoringChatId === chat.id}
                                            key={chat.id}
                                            now={relativeNow}
                                            onRestore={() => {
                                                unarchiveChat.mutate({ chatId: chat.id });
                                            }}
                                        />
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ArchivedChatRow({
    chat,
    isRestoring,
    now,
    onRestore,
}: {
    chat: ChatListItem;
    isRestoring: boolean;
    now: number;
    onRestore: () => void;
}) {
    return (
        <li className="flex items-center gap-1 rounded-lg hover:bg-hover">
            <NavLink
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2"
                to={buildChatPath(chat.id)}
            >
                <ArchivedChatIcon chat={chat} />
                <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                    {chat.title}
                </span>
                <span className="shrink-0 text-meta text-muted-foreground">
                    {getChatLastActivityLabel(chat, now)}
                </span>
            </NavLink>
            <Button
                className="mr-1 shrink-0"
                loading={isRestoring}
                onClick={onRestore}
                size="sm"
                type="button"
                variant="secondary"
            >
                Restore
            </Button>
        </li>
    );
}

function ArchivedChatIcon({ chat }: { chat: ChatListItem }) {
    if (chat.conversationKind === 'channel') {
        return (
            <ChannelIconBox size="topbar" style={getChannelColorStyle(chat.tabAppearance.color)} />
        );
    }

    const name = chat.targetParticipant?.name ?? chat.participants[0]?.name ?? chat.title;

    return (
        <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-[0.4375rem] bg-muted font-medium text-[0.625rem] text-muted-foreground"
        >
            {(name.trim()[0] ?? '?').toUpperCase()}
        </span>
    );
}
