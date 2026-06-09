import { useEffect, useRef, useState } from 'react';
import { SimpleCodeEditor } from '../../../components/code-editor/simple-code-editor.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { usePrimaryAgent } from '../../../hooks/agents/use-agent-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { trpc } from '../../../lib/trpc.tsx';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';

export type EditableAgentWorkspaceFile = 'AGENTS.md' | 'SOUL.md';

export const editableAgentWorkspaceFiles = [
    {
        description: 'Workspace instructions, conventions, architecture, and project context.',
        label: 'AGENTS.md',
        path: 'AGENTS.md',
    },
    {
        description: 'Hermes identity, voice, tone, and durable personality.',
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

    return <AgentWorkspaceFileEditor agentId={agent.id} path={path} />;
}

function AgentWorkspaceFileEditor({
    agentId,
    path,
}: {
    agentId: string;
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
        <section>
            <BadgeDivider className="pb-4">{file?.label ?? path}</BadgeDivider>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">{file?.description}</p>
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
            <CardFrame>
                <Card className="relative h-[calc(100vh-15rem)] min-h-[32rem] overflow-hidden p-0">
                    <SimpleCodeEditor
                        disabled={query.isPending || isSaving}
                        filePath={path}
                        onChange={setDraft}
                        placeholder={`Edit ${path}`}
                        value={draft}
                    />
                </Card>
            </CardFrame>
        </section>
    );
}
