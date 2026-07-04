import { arrayMove } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import { useChatArchive } from '../../../hooks/chats/use-chat-archive.ts';
import { useChatList } from '../../../hooks/chats/use-chat-list.ts';
import { useChatStartDrafts } from '../../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatSystemPrompt } from '../../../hooks/chats/use-chat-system-prompt.ts';
import { useChatTabAppearance } from '../../../hooks/chats/use-chat-tab-appearance.ts';
import { useChatUpdate } from '../../../hooks/chats/use-chat-update.ts';
import { useChatRuntimeTimelineStates } from '../../../hooks/chats/use-timeline-context.tsx';
import { appRoutes } from '../../../lib/app-routes.ts';
import { getDesktopBridge, isElectronDesktopApp } from '../../../lib/desktop-bridge.ts';
import type { ChatListItem } from '../../chats/chat-list-data.ts';
import { buildChatList } from '../../chats/chat-list-data.ts';
import { buildSidebarChatGroups } from '../sidebar-chat-list-model.ts';
import type { BrowserTab } from './browser-tab-store.ts';
import { useBrowserTabs } from './browser-tab-store.ts';
import { buildNewTabPath } from './chat-tabs-model.ts';
import { describeRoute } from './describe-route.tsx';
import { computeDockInsertIndex } from './dock-preview.ts';
import { ShellContext } from './shell-context.tsx';
import { TavernChatTabDialogs } from './tavern-chat-tab-dialogs.tsx';
import { useChatTabKeyboardShortcuts, useTabActionHandler } from './tavern-tab-actions.ts';
import { buildTavernTabRenderers } from './tavern-tab-renderers.tsx';
import type { DockPreview, TabItem, TabsContextValue } from './types.ts';
import { useShellGeometry } from './use-shell-geometry.ts';

const homeLandingRoutes = new Set(['/', appRoutes.overview]);

/**
 * Tavern provider for the browser shell. Tabs are generic browser pages: each tab carries
 * the route it shows, the active tab tracks the current location, and navigating anywhere
 * (a chat, a section, settings) updates the active tab. Chat tabs keep their spinners,
 * pinned colors, and context menu, derived from the tab's route.
 */
export function TavernBrowserTabsProvider({ children }: { children: ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();
    const chatQuery = useChatList();
    const agentsQuery = useAgentList();
    const drafts = useChatStartDrafts();
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const systemPrompt = useChatSystemPrompt();
    const tabAppearance = useChatTabAppearance();
    const timelineStates = useChatRuntimeTimelineStates();
    const [tabState, applyTabs] = useBrowserTabs();
    const [dragging, setDragging] = React.useState(false);
    const [dockPreview, setDockPreview] = React.useState<DockPreview | null>(null);
    const isDesktop = isElectronDesktopApp();
    const [renamingChat, setRenamingChat] = React.useState<ChatListItem | null>(null);
    const [editingParticipantsChat, setEditingParticipantsChat] =
        React.useState<ChatListItem | null>(null);
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
    // Latest chat map for the dock subscription (avoids re-subscribing on every chat change).
    const chatByIdRef = React.useRef(chatById);
    chatByIdRef.current = chatById;
    const hasActiveDraft = drafts.listDrafts().some((draft) => draft.status !== 'error');

    const isChatBusy = React.useCallback(
        (chat: ChatListItem) => chat.hasActiveTurn || timelineStates[chat.id]?.activeTurn != null,
        [timelineStates]
    );

    const currentPath = `${location.pathname}${location.search}`;
    const activeId = tabState.activeId;

    // Routes of tabs closed in this window, newest last — drives Cmd+Shift+T (reopen).
    const recentlyClosedRef = React.useRef<string[]>([]);

    // While a tab from another window is docking, the window previews that tab's content.
    // `dockingRef` suppresses location→tab sync so the existing active tab keeps its route;
    // `currentPathRef` records what to restore if the drag leaves without committing.
    const currentPathRef = React.useRef(currentPath);
    currentPathRef.current = currentPath;
    const dockingRef = React.useRef(false);
    dockingRef.current = dockPreview !== null;

    const tabs = React.useMemo<TabItem[]>(
        () =>
            tabState.tabs.map((tab) => {
                const descriptor = describeRoute(tab.route, chatById);
                const chat = descriptor.chatId ? chatById.get(descriptor.chatId) : undefined;
                const busy =
                    descriptor.kind === 'draft' ? hasActiveDraft : chat ? isChatBusy(chat) : false;

                return {
                    id: tab.id,
                    route: tab.route,
                    title: descriptor.title,
                    busy,
                    closeable: true,
                    sortable: true,
                };
            }),
        [tabState.tabs, chatById, hasActiveDraft, isChatBusy]
    );

    // The active tab always tracks the current location: navigating anywhere updates it.
    const activeIdRef = React.useRef(activeId);
    activeIdRef.current = activeId;
    React.useEffect(() => {
        const id = activeIdRef.current;

        // Don't rewrite the active tab's route while previewing a docking tab's content.
        if (!id || dockingRef.current) {
            return;
        }

        applyTabs((current) => {
            const tab = current.tabs.find((entry) => entry.id === id);

            if (!tab || tab.route === currentPath) {
                return current;
            }

            return {
                ...current,
                tabs: current.tabs.map((entry) =>
                    entry.id === id ? { ...entry, route: currentPath } : entry
                ),
            };
        });
    }, [currentPath, applyTabs]);

    // A window always has at least one tab. A fresh window opens a blank New Tab; a window
    // seeded with a route (tear-off / open-in-new-window) adopts that route.
    const initialized = React.useRef(false);
    React.useEffect(() => {
        if (initialized.current) {
            return;
        }

        initialized.current = true;

        if (tabState.tabs.length > 0) {
            if (!(tabState.activeId && tabState.tabs.some((tab) => tab.id === tabState.activeId))) {
                applyTabs((current) => ({ ...current, activeId: current.tabs[0]?.id ?? null }));
            }

            return;
        }

        const id = crypto.randomUUID();

        if (homeLandingRoutes.has(location.pathname)) {
            const route = buildNewTabPath(crypto.randomUUID());
            applyTabs(() => ({ activeId: id, tabs: [{ id, route }] }));
            void navigate(route);
        } else {
            applyTabs(() => ({ activeId: id, tabs: [{ id, route: currentPath }] }));
        }
    }, [tabState, currentPath, location.pathname, applyTabs, navigate]);

    const routeForId = React.useCallback(
        (id: string) => tabState.tabs.find((tab) => tab.id === id)?.route ?? null,
        [tabState.tabs]
    );

    const openNewTab = React.useCallback(() => {
        const id = crypto.randomUUID();
        const route = buildNewTabPath(crypto.randomUUID());
        applyTabs((current) => ({ activeId: id, tabs: [...current.tabs, { id, route }] }));
        void navigate(route);
    }, [applyTabs, navigate]);

    const activateTab = React.useCallback(
        (id: string) => {
            const route = routeForId(id);

            if (!route) {
                return;
            }

            applyTabs((current) => ({ ...current, activeId: id }));
            void navigate(route);
        },
        [routeForId, applyTabs, navigate]
    );

    // Remove a tab from this window, activating a neighbor. Never leaves the window empty:
    // closing the last tab closes the window (desktop) or opens a fresh blank tab (web).
    const removeTab = React.useCallback(
        (id: string) => {
            const index = tabState.tabs.findIndex((tab) => tab.id === id);

            if (index === -1) {
                return;
            }

            recentlyClosedRef.current.push(tabState.tabs[index].route);
            const remaining = tabState.tabs.filter((tab) => tab.id !== id);

            if (remaining.length === 0) {
                if (isDesktop) {
                    void getDesktopBridge()?.closeWindow();
                    return;
                }

                const freshId = crypto.randomUUID();
                const route = buildNewTabPath(crypto.randomUUID());
                applyTabs(() => ({ activeId: freshId, tabs: [{ id: freshId, route }] }));
                void navigate(route);
                return;
            }

            let nextActive = tabState.activeId;

            if (tabState.activeId === id) {
                const neighbor = remaining[Math.min(index, remaining.length - 1)];
                nextActive = neighbor.id;
                void navigate(neighbor.route);
            }

            applyTabs(() => ({ activeId: nextActive, tabs: remaining }));
        },
        [tabState, isDesktop, applyTabs, navigate]
    );

    // Detach a tab without the empty-window handling (tear-off always leaves ≥1 tab).
    const detachTabLocally = React.useCallback(
        (id: string) => {
            const index = tabState.tabs.findIndex((tab) => tab.id === id);

            if (index === -1) {
                return;
            }

            const remaining = tabState.tabs.filter((tab) => tab.id !== id);
            let nextActive = tabState.activeId;

            if (tabState.activeId === id && remaining.length > 0) {
                const neighbor = remaining[Math.min(index, remaining.length - 1)];
                nextActive = neighbor.id;
                void navigate(neighbor.route);
            }

            applyTabs(() => ({
                activeId: remaining.length > 0 ? nextActive : null,
                tabs: remaining,
            }));
        },
        [tabState, applyTabs, navigate]
    );

    const insertTab = React.useCallback(
        (route: string, index: number) => {
            const id = crypto.randomUUID();
            applyTabs((current) => ({
                activeId: id,
                tabs: insertAt(current.tabs, { id, route }, index),
            }));
            void navigate(route);
        },
        [applyTabs, navigate]
    );

    // A re-attached tab (dropped on this window's strip) is appended and activated.
    React.useEffect(() => {
        const bridge = getDesktopBridge();

        return bridge?.onOpenTab?.((route) => {
            insertTab(route, Number.POSITIVE_INFINITY);
        });
    }, [insertTab]);

    // Open in a new window (menu): seed a window with the route, then drop the tab here.
    const detachTabToWindow = React.useCallback(
        (id: string) => {
            const bridge = getDesktopBridge();
            const route = routeForId(id);

            if (!(bridge && route)) {
                return;
            }

            void bridge.openWindow(route);
            detachTabLocally(id);
        },
        [routeForId, detachTabLocally]
    );

    // Live tab tear-off: remove the tab here and spawn a cursor-following window.
    const startTearOff = React.useCallback(
        (id: string, cursorOffset?: { x: number; y: number }) => {
            const bridge = getDesktopBridge();
            const route = routeForId(id);

            if (!(bridge && route)) {
                return;
            }

            void bridge.tearOffStart(route, cursorOffset);
            detachTabLocally(id);
        },
        [routeForId, detachTabLocally]
    );

    const finishTearOff = React.useCallback(() => {
        void getDesktopBridge()?.tearOffFinish();
    }, []);

    // A lone-tab window moves the whole window; dropping on another window's strip merges.
    const startWindowMove = React.useCallback(
        (id: string) => {
            const bridge = getDesktopBridge();
            const route = routeForId(id);

            if (bridge && route) {
                void bridge.selfMoveStart(route);
            }
        },
        [routeForId]
    );

    const finishWindowMove = React.useCallback(() => {
        void getDesktopBridge()?.selfMoveFinish();
    }, []);

    // Reopen the most recently closed tab in this window, appended and activated.
    const reopenClosedTab = React.useCallback(() => {
        const route = recentlyClosedRef.current.pop();

        if (route) {
            insertTab(route, Number.POSITIVE_INFINITY);
        }
    }, [insertTab]);

    // Cmd+1..8 / Cmd+9 jump to a tab by position; Ctrl+Tab cycles with wraparound.
    const activateByIndex = React.useCallback(
        (index: number) => {
            const target = tabState.tabs[index];

            if (target) {
                activateTab(target.id);
            }
        },
        [tabState.tabs, activateTab]
    );

    const cycleTab = React.useCallback(
        (direction: 1 | -1) => {
            const count = tabState.tabs.length;

            if (count === 0) {
                return;
            }

            const current = tabState.tabs.findIndex((tab) => tab.id === activeId);
            const next = (Math.max(current, 0) + direction + count) % count;
            activateByIndex(next);
        },
        [tabState.tabs, activeId, activateByIndex]
    );

    useChatTabKeyboardShortcuts({
        onCloseActive: () => {
            if (activeId) {
                removeTab(activeId);
            }
        },
        onCycle: cycleTab,
        onNewTab: openNewTab,
        onReopenClosed: reopenClosedTab,
        onSelectIndex: activateByIndex,
        onSelectLast: () => activateByIndex(tabState.tabs.length - 1),
    });

    const archiveTopbarChat = useTabActionHandler(async (chat: ChatListItem) => {
        await archiveChat.mutateAsync({ chatId: chat.id });
    });

    const setPinnedTabColor = useTabActionHandler(
        async (chat: ChatListItem, color: string | null) => {
            await tabAppearance.mutateAsync({ chatId: chat.id, color });
        }
    );

    const frameRef = React.useRef<HTMLDivElement>(null);
    // Track geometry per-frame while a tab from another window is docking too, so the
    // hairline follows the anchored preview tab instead of staying frozen on the old tab.
    const { outline, measure } = useShellGeometry(frameRef, dragging || dockPreview !== null, [
        activeId,
        tabs.length,
    ]);

    // --- Cross-window merge drag (a tab from another window hovering this strip) ---
    const dockXRef = React.useRef<number | null>(null);
    dockXRef.current = dockPreview?.x ?? null;
    // The route a docking tab is previewing, and the content to restore if it leaves.
    const dockedRouteRef = React.useRef<string | null>(null);
    const preDockLocationRef = React.useRef<string | null>(null);

    const commitDockedTab = React.useCallback(
        (route: string) => {
            const index = computeDockInsertIndex(
                frameRef.current,
                dockXRef.current ?? Number.POSITIVE_INFINITY
            );
            setDockPreview(null);
            insertTab(route, index);
        },
        [insertTab]
    );

    React.useEffect(() => {
        const bridge = getDesktopBridge();

        if (!bridge?.onDockUpdate) {
            return;
        }

        const unsubscribe = [
            bridge.onDockUpdate((preview) => {
                setDockPreview({
                    route: preview.route,
                    title: describeRoute(preview.route, chatByIdRef.current).title,
                    x: preview.x,
                });

                // On the first update of this dock, remember the shown content and switch
                // the window to the incoming tab's content so the anchored tab is displayed.
                if (dockedRouteRef.current !== preview.route) {
                    if (dockedRouteRef.current === null) {
                        preDockLocationRef.current = currentPathRef.current;
                    }

                    dockedRouteRef.current = preview.route;
                    void navigate(preview.route);
                }
            }),
            bridge.onDockLeave(() => {
                setDockPreview(null);

                // Undock without committing: restore the content shown before the preview.
                if (dockedRouteRef.current !== null) {
                    dockedRouteRef.current = null;
                    const restore = preDockLocationRef.current;
                    preDockLocationRef.current = null;

                    if (restore !== null) {
                        void navigate(restore);
                    }
                }
            }),
            bridge.onDockCommit((route) => {
                dockedRouteRef.current = null;
                preDockLocationRef.current = null;
                commitDockedTab(route);
            }),
        ];

        return () => {
            for (const off of unsubscribe) {
                off();
            }
        };
    }, [commitDockedTab, navigate]);

    const value: TabsContextValue = {
        state: { tabs, activeId, dragging, dockPreview },
        actions: {
            add: openNewTab,
            close: removeTab,
            finishTearOff: isDesktop ? finishTearOff : undefined,
            finishWindowMove: isDesktop ? finishWindowMove : undefined,
            openInNewWindow: isDesktop ? detachTabToWindow : undefined,
            reorder: (active, over) =>
                applyTabs((current) => {
                    const from = current.tabs.findIndex((tab) => tab.id === active);
                    const to = current.tabs.findIndex((tab) => tab.id === over);

                    if (from === -1 || to === -1) {
                        return current;
                    }

                    return { ...current, tabs: arrayMove(current.tabs, from, to) };
                }),
            setActive: activateTab,
            setDragging,
            startTearOff: isDesktop ? startTearOff : undefined,
            startWindowMove: isDesktop ? startWindowMove : undefined,
        },
        meta: {
            frameRef,
            outline,
            measure,
            ...buildTavernTabRenderers(chatById, {
                onArchive: (selected) => void archiveTopbarChat(selected),
                onCloseTab: (selected) => {
                    const tab = tabState.tabs.find(
                        (entry) => describeRoute(entry.route, chatById).chatId === selected.id
                    );

                    if (tab) {
                        removeTab(tab.id);
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
                onEditParticipants: (selected) => {
                    updateChat.reset();
                    setEditingParticipantsChat(selected);
                },
                onOpenInNewWindow: isDesktop
                    ? (selected) => {
                          const tab = tabState.tabs.find(
                              (entry) => describeRoute(entry.route, chatById).chatId === selected.id
                          );

                          if (tab) {
                              detachTabToWindow(tab.id);
                          }
                      }
                    : undefined,
                onRename: (selected) => {
                    updateChat.reset();
                    setRenamingChat(selected);
                },
            }),
        },
    };

    return (
        <ShellContext value={value}>
            {children}
            <TavernChatTabDialogs
                agents={agentsQuery.data?.agents ?? []}
                agentsPending={agentsQuery.isPending}
                editingParticipantsChat={editingParticipantsChat}
                editingSystemPromptChat={editingSystemPromptChat}
                renamingChat={renamingChat}
                setEditingParticipantsChat={setEditingParticipantsChat}
                setEditingSystemPromptChat={setEditingSystemPromptChat}
                setRenamingChat={setRenamingChat}
                systemPrompt={systemPrompt}
                updateChat={updateChat}
            />
        </ShellContext>
    );
}

/** Inserts an item at a clamped position within a list. */
function insertAt<T>(list: T[], item: T, position: number): T[] {
    const at = Math.max(0, Math.min(position, list.length));
    return [...list.slice(0, at), item, ...list.slice(at)];
}

export type { BrowserTab };
