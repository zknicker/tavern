import type { AgentRuntimeChatPaneState } from '@tavern/api';
import { mergeChatPaneOpenTarget } from '@tavern/api/pane-links';
import * as React from 'react';
import {
    getArtifactPanelTargetKey,
    type TavernResourceTarget,
} from '../../features/chats/tavern-resource-link.ts';
import { trpc } from '../../lib/trpc.tsx';
import { setPaneVisibilityOverride, usePaneVisibilityOverride } from './use-pane-visibility.ts';

export interface ChatArtifactPanelState {
    activeKey: string | null;
    closeActiveTarget: () => void;
    closeTarget: (key: string) => void;
    open: (target: TavernResourceTarget) => void;
    setActiveKey: (key: string) => void;
    targets: TavernResourceTarget[];
    toggleVisible: () => void;
    visible: boolean;
}

// The pane's tab set is a Runtime-owned per-chat record (revision-guarded),
// so tabs survive reloads and agent UI intents land in the same state. Every
// gesture rebases on the freshest cache, applies optimistically, and the
// mutation result (success or 409-with-current-state) converges the cache.
export function useChatArtifactPanelState(chatId: string): ChatArtifactPanelState {
    const utils = trpc.useUtils();
    const query = trpc.pane.get.useQuery({ chatId }, { enabled: chatId.length > 0 });

    const setPaneState = trpc.pane.set.useMutation({
        onError: () => {
            void utils.pane.get.invalidate({ chatId });
        },
        onSuccess: (result) => {
            utils.pane.get.setData({ chatId }, result.state);
        },
    });
    const mutate = setPaneState.mutate;

    const apply = React.useCallback(
        (next: { activeKey: string | null; targets: TavernResourceTarget[] }) => {
            const current = utils.pane.get.getData({ chatId }) ?? emptyPaneState(chatId);
            utils.pane.get.setData(
                { chatId },
                {
                    ...current,
                    activeKey: next.activeKey,
                    revision: current.revision + 1,
                    targets: next.targets,
                }
            );
            mutate({
                activeKey: next.activeKey,
                chatId,
                expectedRevision: current.revision,
                targets: next.targets,
            });
        },
        [chatId, mutate, utils]
    );

    const readTargets = React.useCallback(() => {
        const current = utils.pane.get.getData({ chatId }) ?? emptyPaneState(chatId);
        return { activeKey: current.activeKey, targets: current.targets };
    }, [chatId, utils]);

    const open = React.useCallback(
        (target: TavernResourceTarget) => {
            const { activeKey, targets } = readTargets();
            setPaneVisibilityOverride(chatId, true);
            const merged = mergeChatPaneOpenTarget(targets, target);
            // Already open and focused: writing anyway would drift the
            // optimistic revision ahead of the server and echo through the
            // pane.updated invalidation loop.
            if (merged.targets === targets && merged.activeKey === activeKey) {
                return;
            }
            apply(merged);
        },
        [apply, chatId, readTargets]
    );

    const closeTarget = React.useCallback(
        (key: string) => {
            const { activeKey, targets } = readTargets();
            const closingIndex = targets.findIndex(
                (target) => getArtifactPanelTargetKey(target) === key
            );
            if (closingIndex === -1) {
                return;
            }
            const next = targets.filter((target) => getArtifactPanelTargetKey(target) !== key);
            const nextActive =
                activeKey === key
                    ? (next.at(Math.min(closingIndex, next.length - 1)) ?? null)
                    : null;
            apply({
                activeKey:
                    activeKey === key
                        ? nextActive && getArtifactPanelTargetKey(nextActive)
                        : activeKey,
                targets: next,
            });
        },
        [apply, readTargets]
    );

    const closeActiveTarget = React.useCallback(() => {
        const { activeKey } = readTargets();
        if (activeKey) {
            closeTarget(activeKey);
        }
    }, [closeTarget, readTargets]);

    const setActiveKey = React.useCallback(
        (key: string) => {
            const { targets } = readTargets();
            apply({ activeKey: key, targets });
        },
        [apply, readTargets]
    );

    const state = query.data ?? emptyPaneState(chatId);
    const visibilityOverride = usePaneVisibilityOverride(chatId);
    const visible = visibilityOverride ?? state.targets.length > 0;

    const toggleVisible = React.useCallback(() => {
        setPaneVisibilityOverride(chatId, !visible);
    }, [chatId, visible]);

    return {
        activeKey: state.activeKey,
        closeActiveTarget,
        closeTarget,
        open,
        setActiveKey,
        targets: state.targets,
        toggleVisible,
        visible,
    };
}

function emptyPaneState(chatId: string): AgentRuntimeChatPaneState {
    return { activeKey: null, chatId, revision: 0, targets: [], updatedAt: null };
}
