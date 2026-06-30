import { arrayMove } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import * as React from 'react';
import { useChatArchive } from '../../../hooks/chats/use-chat-archive.ts';
import { useChatList } from '../../../hooks/chats/use-chat-list.ts';
import { useChatPin } from '../../../hooks/chats/use-chat-pin.ts';
import { useChatSystemPrompt } from '../../../hooks/chats/use-chat-system-prompt.ts';
import { useChatTabAppearance } from '../../../hooks/chats/use-chat-tab-appearance.ts';
import { useChatUpdate } from '../../../hooks/chats/use-chat-update.ts';
import type { DesktopTabsState } from '../../../lib/desktop-bridge.ts';
import { getDesktopBridge } from '../../../lib/desktop-bridge.ts';
import type { ChatListItem } from '../../chats/chat-list-data.ts';
import { buildChatList } from '../../chats/chat-list-data.ts';
import { buildSidebarChatGroups } from '../sidebar-chat-list-model.ts';
import { buildNewTabPath } from './chat-tabs-model.ts';
import { describeRoute } from './describe-route.tsx';
import type { DockEntry } from './dock-entry-context.ts';
import { DockEntryContext, dockGlideMs } from './dock-entry-context.ts';
import { computeDockInsertIndex } from './dock-preview.ts';
import { ShellContext } from './shell-context.tsx';
import { TavernChatTabDialogs } from './tavern-chat-tab-dialogs.tsx';
import { useChatTabKeyboardShortcuts, useTabActionHandler } from './tavern-tab-actions.ts';
import { buildTavernTabRenderers } from './tavern-tab-renderers.tsx';
import type { DockPreview, TabItem, TabsContextValue } from './types.ts';
import { useShellGeometry } from './use-shell-geometry.ts';

const emptyTabs: DesktopTabsState = { activeId: null, tabs: [] };

/**
 * Tab provider for the chrome surface. Tab state is owned by the main process (each tab is a
 * WebContentsView), so this mirrors main's tab list over IPC and routes every action back to
 * main. Tab presentation (title, favicon, pinned color, context menu) is derived from the
 * route exactly like the in-renderer provider.
 */
export function ChromeTabsProvider({ children }: { children: ReactNode }) {
    const bridge = getDesktopBridge();
    const chatQuery = useChatList();
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const pinChat = useChatPin();
    const systemPrompt = useChatSystemPrompt();
    const tabAppearance = useChatTabAppearance();
    const [tabState, setTabState] = React.useState<DesktopTabsState>(emptyTabs);
    const [dragging, setDragging] = React.useState(false);
    const [dockPreview, setDockPreview] = React.useState<DockPreview | null>(null);
    const [dockEntry, setDockEntry] = React.useState<DockEntry | null>(null);
    const [renamingChat, setRenamingChat] = React.useState<ChatListItem | null>(null);
    const [editingSystemPromptChat, setEditingSystemPromptChat] =
        React.useState<ChatListItem | null>(null);

    const allChats = React.useMemo(
        () => buildSidebarChatGroups(buildChatList(chatQuery.data)).allChats,
        [chatQuery.data]
    );
    const chatById = React.useMemo(
        () => new Map(allChats.map((chat) => [chat.id, chat])),
        [allChats]
    );
    const chatByIdRef = React.useRef(chatById);
    chatByIdRef.current = chatById;
    const frameRef = React.useRef<HTMLDivElement>(null);
    const tabStateRef = React.useRef(tabState);
    tabStateRef.current = tabState;
    // The last cursor-x of a docking ghost, and the pending dock waiting for its tab to land.
    const lastDockXRef = React.useRef(0);
    const pendingDockRef = React.useRef<{ fromX: number } | null>(null);

    // Apply main's tab list, skipping a no-op echo so it can't interrupt dnd-kit's drop slide.
    // When a docked tab lands, flag it so it glides in from the release cursor (see DockEntry).
    const applyTabState = React.useCallback((next: DesktopTabsState) => {
        const current = tabStateRef.current;

        if (sameTabs(current, next)) {
            return;
        }

        const pending = pendingDockRef.current;

        if (pending) {
            const arrived = next.tabs.find(
                (tab) => !current.tabs.some((existing) => existing.id === tab.id)
            );

            if (arrived) {
                pendingDockRef.current = null;
                setDockEntry({ id: arrived.id, fromX: pending.fromX });
                window.setTimeout(() => setDockEntry(null), dockGlideMs);
            }
        }

        setTabState(next);
    }, []);

    // Mirror the main process's tab list.
    React.useEffect(() => {
        if (!bridge?.onTabsChanged) {
            return;
        }

        void bridge.getTabs().then(applyTabState);
        return bridge.onTabsChanged(applyTabState);
    }, [bridge, applyTabState]);

    // A tab dragged in from another window hovers this strip: main forwards the cursor so we
    // render a ghost and report where the tab should land. The committed tab itself arrives
    // via the main-owned tab list.
    React.useEffect(() => {
        if (!bridge?.onDockUpdate) {
            return;
        }

        const unsubscribe = [
            bridge.onDockUpdate((preview) => {
                lastDockXRef.current = preview.x;
                setDockPreview({
                    route: preview.route,
                    title: describeRoute(preview.route, chatByIdRef.current).title,
                    x: preview.x,
                });
                void bridge.dockSetIndex(computeDockInsertIndex(frameRef.current, preview.x));
            }),
            bridge.onDockLeave(() => setDockPreview(null)),
            bridge.onDockCommit(() => {
                // Glide the incoming tab in from the cursor once it lands (see applyTabState).
                pendingDockRef.current = { fromX: lastDockXRef.current };
                setDockPreview(null);
            }),
        ];

        return () => {
            for (const off of unsubscribe) {
                off();
            }
        };
    }, [bridge]);

    const activeId = tabState.activeId;
    const tabs = React.useMemo<TabItem[]>(
        () =>
            tabState.tabs.map((tab) => {
                const descriptor = describeRoute(tab.route, chatById);
                const chat = descriptor.chatId ? chatById.get(descriptor.chatId) : undefined;

                return {
                    id: tab.id,
                    route: tab.route,
                    title: descriptor.title,
                    busy: chat?.hasActiveTurn ?? false,
                    closeable: true,
                    sortable: true,
                };
            }),
        [tabState.tabs, chatById]
    );

    const tabByChatId = React.useCallback(
        (chatId: string) =>
            tabState.tabs.find((tab) => describeRoute(tab.route, chatById).chatId === chatId),
        [tabState.tabs, chatById]
    );

    const openNewTab = React.useCallback(() => {
        void bridge?.createTab(buildNewTabPath(crypto.randomUUID()));
    }, [bridge]);

    // Track geometry per-frame through a docked tab's glide too, so the hairline follows it.
    const { outline, measure } = useShellGeometry(frameRef, dragging || dockEntry !== null, [
        activeId,
        tabs.length,
    ]);

    const archiveTopbarChat = useTabActionHandler(async (chat: ChatListItem) => {
        await archiveChat.mutateAsync({ chatId: chat.id });
    });
    const pinTopbarChat = useTabActionHandler(async (chat: ChatListItem, pinned: boolean) => {
        await pinChat.mutateAsync({ chatId: chat.id, pinned });
    });
    const setPinnedTabColor = useTabActionHandler(
        async (chat: ChatListItem, color: string | null) => {
            await tabAppearance.mutateAsync({ chatId: chat.id, color });
        }
    );

    useChatTabKeyboardShortcuts({
        onCloseActive: () => {
            if (activeId) {
                void bridge?.closeTab(activeId);
            }
        },
        onCycle: (direction) => {
            const count = tabState.tabs.length;

            if (count === 0) {
                return;
            }

            const current = tabState.tabs.findIndex((tab) => tab.id === activeId);
            const next = (Math.max(current, 0) + direction + count) % count;
            const target = tabState.tabs[next];

            if (target) {
                void bridge?.activateTab(target.id);
            }
        },
        onNewTab: openNewTab,
        onReopenClosed: () => undefined,
        onSelectIndex: (index) => {
            const target = tabState.tabs[index];

            if (target) {
                void bridge?.activateTab(target.id);
            }
        },
        onSelectLast: () => {
            const target = tabState.tabs.at(-1);

            if (target) {
                void bridge?.activateTab(target.id);
            }
        },
    });

    const value: TabsContextValue = {
        state: { tabs, activeId, dragging, dockPreview },
        actions: {
            add: openNewTab,
            close: (id) => void bridge?.closeTab(id),
            finishTearOff: () => void bridge?.tearOffFinish(),
            finishWindowMove: () => void bridge?.selfMoveFinish(),
            startTearOff: (id, cursorOffset) => void bridge?.tearOffStart(id, cursorOffset),
            startWindowMove: (id) => void bridge?.selfMoveStart(id),
            reorder: (active, over) => {
                const from = tabState.tabs.findIndex((tab) => tab.id === active);
                const to = tabState.tabs.findIndex((tab) => tab.id === over);

                if (from === -1 || to === -1) {
                    return;
                }

                // Optimistic reorder; main confirms via the next onTabsChanged.
                setTabState((current) => ({
                    ...current,
                    tabs: arrayMove(current.tabs, from, to),
                }));
                void bridge?.reorderTabs(arrayMove(tabState.tabs, from, to).map((tab) => tab.id));
            },
            setActive: (id) => void bridge?.activateTab(id),
            setDragging,
        },
        meta: {
            frameRef,
            outline,
            measure,
            ...buildTavernTabRenderers(chatById, {
                onArchive: (selected) => void archiveTopbarChat(selected),
                onCloseTab: (selected) => {
                    const tab = tabByChatId(selected.id);

                    if (tab) {
                        void bridge?.closeTab(tab.id);
                    }
                },
                onCustomizeColor: (selected, color) => {
                    tabAppearance.reset();
                    void setPinnedTabColor(selected, color);
                },
                onEditSystemPrompt: (selected) => {
                    systemPrompt.reset();
                    setEditingSystemPromptChat(selected);
                },
                onPinChange: (selected, pinned) => void pinTopbarChat(selected, pinned),
                onRename: (selected) => {
                    updateChat.reset();
                    setRenamingChat(selected);
                },
            }),
        },
    };

    return (
        <ShellContext value={value}>
            <DockEntryContext.Provider value={dockEntry}>{children}</DockEntryContext.Provider>
            <TavernChatTabDialogs
                editingSystemPromptChat={editingSystemPromptChat}
                renamingChat={renamingChat}
                setEditingSystemPromptChat={setEditingSystemPromptChat}
                setRenamingChat={setRenamingChat}
                systemPrompt={systemPrompt}
                updateChat={updateChat}
            />
        </ShellContext>
    );
}

/** Whether two tab lists are identical (same active tab, same ids and routes in order). */
function sameTabs(a: DesktopTabsState, b: DesktopTabsState): boolean {
    return (
        a.activeId === b.activeId &&
        a.tabs.length === b.tabs.length &&
        a.tabs.every(
            (tab, index) => tab.id === b.tabs[index].id && tab.route === b.tabs[index].route
        )
    );
}
