import type { ChatPaneTarget } from '@tavern/api';
// Value imports must use the pane-links subpath: the @tavern/api root index
// reaches node:crypto via runtime config helpers and cannot evaluate in the
// browser.
import {
    formatChatPaneTargetLink,
    isWorkspaceChatPaneTarget,
    parseChatPaneTargetLink,
} from '@tavern/api/pane-links';

// Pane targets and the grotto:// link scheme are the Runtime contract's; the
// app-local aliases keep chat feature imports stable.
export type TavernResourceTarget = ChatPaneTarget;

export const parseTavernResourceLink = parseChatPaneTargetLink;
export const formatTavernResourceLink = formatChatPaneTargetLink;
export { isWorkspaceChatPaneTarget };

export function getArtifactPanelTargetKey(target: TavernResourceTarget) {
    return `${target.kind}:${target.path}`;
}

export function getArtifactPanelTargetLabel(target: TavernResourceTarget) {
    // The workspace is one tab; it reads "Workspace" whenever no file is open.
    if (target.kind === 'workspaceDirectory' || target.kind === 'workspaceRoot') {
        return 'Workspace';
    }

    const label = target.path.split('/').filter(Boolean).at(-1);
    return label && label.length > 0 ? label : target.path;
}
