import { useEffect, useRef, useState } from 'react';
import { SimpleCodeEditor } from '../../../components/code-editor/simple-code-editor.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SettingsSection } from '../../../components/ui/settings-row.tsx';
import { usePrimaryAgent } from '../../../hooks/agents/use-agent-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { trpc } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { AgentInstructionsPreviewDrawer } from './agent-instructions-preview-drawer.tsx';

export type EditableAgentWorkspaceFile = 'NOTES.md' | 'SOUL.md';

export const editableAgentWorkspaceFiles = [
    {
        description: 'Notes and conventions, woven into AGENTS.md.',
        label: 'NOTES.md',
        path: 'NOTES.md',
    },
    {
        description: "Your agent's identity, voice, and personality.",
        label: 'SOUL.md',
        path: 'SOUL.md',
    },
] as const satisfies ReadonlyArray<{
    description: string;
    label: string;
    path: EditableAgentWorkspaceFile;
}>;

export function AgentWorkspaceFileSettingsPage({ path }: { path: EditableAgentWorkspaceFile }) {
    const primaryAgentQuery = usePrimaryAgent();

    if (primaryAgentQuery.isPending) {
        return <p className="text-muted-foreground text-sm">Loading workspace file...</p>;
    }

    const agent = primaryAgentQuery.data?.agent ?? null;

    if (!agent) {
        return <MissingAgentState agentId="primary" />;
    }

    return <AgentWorkspaceFileEditor agentId={agent.id} agentName={agent.name} path={path} />;
}

export function AgentWorkspaceFileEditor({
    agentId,
    agentName,
    editorClassName,
    path,
}: {
    agentId: string;
    agentName: string;
    editorClassName?: string;
    path: EditableAgentWorkspaceFile;
}) {
    const utils = trpc.useUtils();
    const file = editableAgentWorkspaceFiles.find((entry) => entry.path === path);
    const query = trpc.agent.workspaceFile.useQuery({ agentId, path });
    const saveWorkspaceFile = trpc.agent.saveWorkspaceFile.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.agent.workspaceFile.invalidate({ agentId, path }),
                utils.agent.instructions.invalidate({ agentId }),
            ]);
        },
    });
    const savedContent = query.data?.content ?? '';
    const [draft, setDraft] = useState('');
    const savedContentRef = useRef('');
    const isSaving = saveWorkspaceFile.isPending;
    const hasChanges = draft !== savedContent;

    useEffect(() => {
        const content = query.data?.content;

        if (content === undefined || savedContentRef.current === content) {
            return;
        }

        const previousSaved = savedContentRef.current;
        savedContentRef.current = content;
        setDraft((current) => (current === previousSaved ? content : current));
    }, [query.data?.content]);

    return (
        <SettingsSection
            action={
                <div className="flex items-center gap-2">
                    {path === 'NOTES.md' ? (
                        <AgentInstructionsPreviewDrawer
                            agentDisplayName={agentName}
                            agentId={agentId}
                        />
                    ) : null}
                    <Button
                        disabled={!hasChanges || query.isPending || isSaving}
                        loading={isSaving}
                        onClick={() =>
                            void withSavingToast(() =>
                                saveWorkspaceFile.mutateAsync({
                                    agentId,
                                    content: draft,
                                    path,
                                })
                            ).then((saved) => {
                                savedContentRef.current = saved.content;
                                setDraft(saved.content);
                            })
                        }
                    >
                        Save
                    </Button>
                </div>
            }
            title={file?.label ?? path}
        >
            <CardFrame>
                <Card
                    className={cn(
                        'relative h-[calc(100vh-15rem)] min-h-[28rem] overflow-hidden p-0',
                        editorClassName
                    )}
                >
                    <SimpleCodeEditor
                        disabled={query.isPending || isSaving}
                        filePath={path}
                        onChange={setDraft}
                        placeholder={`Edit ${path}`}
                        value={draft}
                    />
                </Card>
            </CardFrame>
        </SettingsSection>
    );
}
