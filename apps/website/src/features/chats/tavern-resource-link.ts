import type { ChatPaneTarget } from '@tavern/api';
import { formatChatPaneTargetLink, parseChatPaneTargetLink } from '@tavern/api';

// Pane targets and the tavern:// link scheme are the Runtime contract's; the
// app-local aliases keep chat feature imports stable.
export type TavernResourceTarget = ChatPaneTarget;

export const parseTavernResourceLink = parseChatPaneTargetLink;
export const formatTavernResourceLink = formatChatPaneTargetLink;

export function getArtifactPanelTargetKey(target: TavernResourceTarget) {
    return `${target.kind}:${target.path}`;
}

export function getArtifactPanelTargetLabel(target: TavernResourceTarget) {
    if (target.kind === 'wikiDirectory') {
        return target.path ? (target.path.split('/').filter(Boolean).at(-1) ?? 'Wiki') : 'Wiki';
    }

    if (target.kind === 'workspaceDirectory') {
        return target.path
            ? (target.path.split('/').filter(Boolean).at(-1) ?? 'Workspace')
            : 'Workspace';
    }

    if (target.kind === 'workspaceRoot') {
        return 'Workspace';
    }

    const label = target.path.split('/').filter(Boolean).at(-1);
    return label && label.length > 0 ? label : target.path;
}
