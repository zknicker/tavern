import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { TabPanel, Tabs } from '../../components/ui/tabs.tsx';
import { useVaultPage } from '../../hooks/vault/use-vault-page.ts';
import { cn } from '../../lib/utils.ts';
import { VaultMarkdownViewer } from '../vault/vault-markdown-viewer.tsx';
import { ArtifactPanelChrome } from './chat-artifact-panel-chrome.tsx';
import { VaultBrowserContent } from './chat-artifact-vault-content.tsx';
import { WorkspaceBrowserContent } from './chat-artifact-workspace-content.tsx';
import { WorkspaceArtifactContent } from './chat-artifact-workspace-preview.tsx';
import { getArtifactPanelTargetKey, type TavernResourceTarget } from './tavern-resource-link.ts';

interface ChatArtifactPanelState {
    activeKey: string | null;
    close: () => void;
    closeActiveTarget: () => void;
    closeTarget: (key: string) => void;
    open: (target: TavernResourceTarget) => void;
    setActiveKey: (key: string) => void;
    targets: TavernResourceTarget[];
}

export function useChatArtifactPanelState(chatId: string): ChatArtifactPanelState {
    const [targets, setTargets] = React.useState<TavernResourceTarget[]>([]);
    const [activeKey, setActiveKey] = React.useState<string | null>(null);
    const resetForChat = React.useCallback((_chatId: string) => {
        setTargets([]);
        setActiveKey(null);
    }, []);

    React.useEffect(() => {
        resetForChat(chatId);
    }, [chatId, resetForChat]);

    const open = React.useCallback((target: TavernResourceTarget) => {
        const key = getArtifactPanelTargetKey(target);
        setTargets((current) =>
            current.some((entry) => getArtifactPanelTargetKey(entry) === key)
                ? current
                : [...current, target]
        );
        setActiveKey(key);
    }, []);

    const close = React.useCallback(() => {
        setTargets([]);
        setActiveKey(null);
    }, []);

    const closeActiveTarget = React.useCallback(() => {
        setTargets((current) => {
            if (!activeKey) {
                return current;
            }

            const activeIndex = current.findIndex(
                (target) => getArtifactPanelTargetKey(target) === activeKey
            );
            const next = current.filter(
                (target) => getArtifactPanelTargetKey(target) !== activeKey
            );
            const nextActive = next.at(Math.min(activeIndex, next.length - 1)) ?? null;
            setActiveKey(nextActive ? getArtifactPanelTargetKey(nextActive) : null);
            return next;
        });
    }, [activeKey]);

    const closeTarget = React.useCallback(
        (key: string) => {
            setTargets((current) => {
                const closingIndex = current.findIndex(
                    (target) => getArtifactPanelTargetKey(target) === key
                );
                if (closingIndex === -1) {
                    return current;
                }

                const next = current.filter((target) => getArtifactPanelTargetKey(target) !== key);
                if (activeKey === key) {
                    const nextActive = next.at(Math.min(closingIndex, next.length - 1)) ?? null;
                    setActiveKey(nextActive ? getArtifactPanelTargetKey(nextActive) : null);
                }
                return next;
            });
        },
        [activeKey]
    );

    return {
        activeKey,
        close,
        closeActiveTarget,
        closeTarget,
        open,
        setActiveKey,
        targets,
    };
}

export function ChatArtifactPanel({
    agentId,
    state,
}: {
    agentId: string;
    state: ChatArtifactPanelState;
}) {
    const shouldReduceMotion = useReducedMotion();
    const open = state.targets.length > 0 && state.activeKey !== null;
    const [resizingArtifactPane, setResizingArtifactPane] = React.useState(false);
    const artifactPaneWidth = useResizablePaneWidth({
        defaultWidth: 560,
        maxWidth: 880,
        minWidth: 420,
        storageKey: 'tavern.artifactPane.width',
    });

    return (
        <AnimatePresence initial={false}>
            {open ? (
                <motion.aside
                    animate={{ opacity: 1, width: artifactPaneWidth.width, x: 0 }}
                    aria-label="Artifacts"
                    className="relative z-[36] hidden h-full min-h-0 shrink-0 overflow-hidden border-border/70 border-l bg-background/96 shadow-2xl shadow-black/8 lg:flex"
                    exit={{ opacity: 0, width: 0, x: 36 }}
                    initial={shouldReduceMotion ? false : { opacity: 0, width: 0, x: 36 }}
                    transition={
                        shouldReduceMotion
                            ? { duration: 0.12 }
                            : {
                                  opacity: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                                  width: {
                                      duration: resizingArtifactPane ? 0 : 0.28,
                                      ease: [0.16, 1, 0.3, 1],
                                  },
                                  x: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                              }
                    }
                >
                    <ResizablePaneRail
                        maxWidth={880}
                        minWidth={420}
                        onResizeEnd={() => setResizingArtifactPane(false)}
                        onResizeStart={() => setResizingArtifactPane(true)}
                        onWidthChange={artifactPaneWidth.setWidth}
                        onWidthCommit={artifactPaneWidth.persistWidth}
                        side="left"
                        width={artifactPaneWidth.width}
                    />
                    <div
                        className="flex h-full min-h-0 flex-col"
                        style={{ width: artifactPaneWidth.width }}
                    >
                        <Tabs
                            className="flex min-h-0 flex-1 flex-col"
                            onValueChange={state.setActiveKey}
                            value={state.activeKey ?? undefined}
                        >
                            <ArtifactPanelChrome
                                activeKey={state.activeKey}
                                activeTarget={state.targets.find(
                                    (target) =>
                                        getArtifactPanelTargetKey(target) === state.activeKey
                                )}
                                agentId={agentId}
                                onClose={state.close}
                                onCloseTarget={state.closeTarget}
                                onOpenTarget={state.open}
                                targets={state.targets}
                            />
                            <div className="min-h-0 flex-1">
                                {state.targets.map((target) => (
                                    <TabPanel
                                        className="h-full min-h-0"
                                        key={getArtifactPanelTargetKey(target)}
                                        value={getArtifactPanelTargetKey(target)}
                                    >
                                        <ArtifactPanelContent agentId={agentId} target={target} />
                                    </TabPanel>
                                ))}
                            </div>
                        </Tabs>
                    </div>
                </motion.aside>
            ) : null}
        </AnimatePresence>
    );
}

function ArtifactPanelContent({
    agentId,
    target,
}: {
    agentId: string;
    target: TavernResourceTarget;
}) {
    if (target.kind === 'vaultPage') {
        return <VaultArtifactContent target={target} />;
    }

    if (target.kind === 'vaultDirectory') {
        return <VaultBrowserContent initialDirectoryPath={target.path} />;
    }

    if (target.kind === 'workspaceRoot' || target.kind === 'workspaceDirectory') {
        return <WorkspaceBrowserContent agentId={agentId} initialDirectoryPath={target.path} />;
    }

    return <WorkspaceArtifactContent agentId={agentId} target={target} />;
}

function VaultArtifactContent({
    target,
}: {
    target: Extract<TavernResourceTarget, { kind: 'vaultPage' }>;
}) {
    const pageQuery = useVaultPage({ path: target.path });

    if (pageQuery.isPending) {
        return <ArtifactPanelEmpty detail="Loading Vault page..." title={target.path} />;
    }

    if (pageQuery.error) {
        return <ArtifactPanelEmpty detail="Unable to load this Vault page." title={target.path} />;
    }

    if (!pageQuery.data) {
        return (
            <ArtifactPanelEmpty detail="No Vault page exists at this path." title={target.path} />
        );
    }

    return (
        <ScrollArea className="h-full min-h-0" scrollFade>
            <article className="mx-auto max-w-[42rem] px-7 pt-7 pb-12">
                <VaultMarkdownViewer value={pageQuery.data.body} />
            </article>
        </ScrollArea>
    );
}

function ArtifactPanelEmpty({ detail, title }: { detail: string; title: string }) {
    return (
        <div className="grid h-full min-h-0 place-items-center px-8 text-center">
            <div className="max-w-sm">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/35">
                    <Icon className="size-4 text-muted-foreground" icon={File01Icon} />
                </div>
                <div className="truncate font-medium text-sm">{title}</div>
                <div className={cn('mt-1 text-muted-foreground text-sm leading-6')}>{detail}</div>
            </div>
        </div>
    );
}
