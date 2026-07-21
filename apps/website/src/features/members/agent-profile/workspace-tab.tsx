import { ArrowLeft02Icon, FileEditIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { CopyButton } from '../../../components/ui/copy-button.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { trpc } from '../../../lib/trpc.tsx';
import { WorkspaceBrowserContent } from '../../chats/chat-artifact-workspace-content.tsx';
import {
    AgentWorkspaceFileEditor,
    type EditableAgentWorkspaceFile,
    editableAgentWorkspaceFiles,
} from './workspace-file-editor.tsx';

export function AgentWorkspaceTab({ agentId, agentName }: { agentId: string; agentName: string }) {
    const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
    const [editingPath, setEditingPath] = React.useState<EditableAgentWorkspaceFile | null>(null);
    const workspaceQuery = trpc.agent.workspaceFiles.useQuery({ agentId, path: '' });
    const selectPath = React.useCallback((path: string | null) => {
        setSelectedPath(path);
        setEditingPath(isEditableWorkspaceFile(path) ? path : null);
    }, []);
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
                <div className="flex shrink-0 items-center gap-1.5">
                    {editableAgentWorkspaceFiles.map((file) => (
                        <Button
                            key={file.path}
                            onClick={() => selectPath(file.path)}
                            size="sm"
                            variant="outline"
                        >
                            <Icon icon={FileEditIcon} />
                            Edit {file.label}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="min-h-0 flex-1 pt-3">
                {editingPath ? (
                    <div className="h-full overflow-y-auto px-3">
                        <Button
                            className="mb-3"
                            onClick={() => setEditingPath(null)}
                            size="sm"
                            variant="ghost"
                        >
                            <Icon icon={ArrowLeft02Icon} />
                            Back to workspace
                        </Button>
                        <AgentWorkspaceFileEditor
                            agentId={agentId}
                            agentName={agentName}
                            editorClassName="h-[calc(100vh-21rem)] min-h-[24rem]"
                            path={editingPath}
                        />
                    </div>
                ) : (
                    <WorkspaceBrowserContent
                        agentId={agentId}
                        onSelectPath={selectPath}
                        selectedPath={selectedPath}
                        sidebarStorageKey={`tavern.agent-profile.${agentId}.workspace.width`}
                    />
                )}
            </div>
        </div>
    );
}

function isEditableWorkspaceFile(path: string | null): path is EditableAgentWorkspaceFile {
    return path === 'NOTES.md' || path === 'SOUL.md';
}
