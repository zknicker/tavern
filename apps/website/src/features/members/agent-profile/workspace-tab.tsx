import * as React from 'react';
import { CopyButton } from '../../../components/ui/copy-button.tsx';
import { trpc } from '../../../lib/trpc.tsx';
import { WorkspaceBrowserContent } from '../../chats/chat-artifact-workspace-content.tsx';

// Read-only by design: the workspace (MEMORY.md, notes/) is agent-maintained
// memory, and identity steering lives in the Profile tab's description field
// (specs/raft-alignment W2 — SOUL retired).
export function AgentWorkspaceTab({ agentId }: { agentId: string }) {
    const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
    const workspaceQuery = trpc.agent.workspaceFiles.useQuery({ agentId, path: '' });
    const workspaceRoot = workspaceQuery.data?.workspaceRoot ?? '';

    return (
        <div className="flex h-full min-h-[32rem] flex-col py-3">
            <div className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-border border-b px-3 pb-3">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-mono text-meta text-muted-foreground">
                        {workspaceRoot || 'Workspace'}
                    </span>
                    <CopyButton
                        disabled={!workspaceRoot}
                        label="Copy workspace path"
                        value={workspaceRoot}
                    />
                </div>
            </div>
            <div className="min-h-0 flex-1 pt-3">
                <WorkspaceBrowserContent
                    agentId={agentId}
                    onSelectPath={setSelectedPath}
                    selectedPath={selectedPath}
                    sidebarStorageKey={`tavern.agent-profile.${agentId}.workspace.width`}
                />
            </div>
        </div>
    );
}
