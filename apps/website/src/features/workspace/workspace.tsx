import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePrimaryAgentSuspense } from '../../hooks/agents/use-agent-list.ts';
import { MissingAgentState } from '../agents/missing-agent-state.tsx';
import { WorkspaceBrowserContent } from '../chats/chat-artifact-workspace-content.tsx';

/**
 * The Workspace page. The open file lives in the URL (`?file=`) so it is part of the tab's
 * route — the selection then survives the tab being torn off or merged into another window.
 */
export function Workspace() {
    const [primaryAgent] = usePrimaryAgentSuspense();
    const agent = primaryAgent.agent;
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedPath = searchParams.get('file');

    const onSelectPath = React.useCallback(
        (path: null | string) => {
            setSearchParams(
                (current) => {
                    const next = new URLSearchParams(current);

                    if (path) {
                        next.set('file', path);
                    } else {
                        next.delete('file');
                    }

                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    if (!agent) {
        return <MissingAgentState agentId="primary" />;
    }

    return (
        <WorkspaceBrowserContent
            agentId={agent.id}
            onSelectPath={onSelectPath}
            selectedPath={selectedPath}
            sidebarStorageKey="tavern.workspace.sidebar.width"
        />
    );
}
