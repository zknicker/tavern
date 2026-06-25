import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { SimpleCodeEditor } from '../../components/code-editor/simple-code-editor.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { trpc } from '../../lib/trpc.tsx';
import type { TavernResourceTarget } from './tavern-resource-link.ts';

export function WorkspaceArtifactContent({
    agentId,
    target,
}: {
    agentId: string;
    target: Extract<TavernResourceTarget, { kind: 'workspaceFile' }>;
}) {
    const fileQuery = trpc.agent.workspaceReadableFile.useQuery(
        { agentId, path: target.path },
        { enabled: agentId.length > 0 }
    );

    if (!agentId) {
        return (
            <WorkspaceArtifactEmpty
                detail="No active agent workspace is available."
                title={target.path}
            />
        );
    }

    if (fileQuery.isPending) {
        return <WorkspaceArtifactEmpty detail="Loading workspace file..." title={target.path} />;
    }

    if (fileQuery.error) {
        return (
            <WorkspaceArtifactEmpty
                detail="Unable to load this workspace file."
                title={target.path}
            />
        );
    }

    const file = fileQuery.data;

    if (file.binary && !file.mediaType.startsWith('image/')) {
        return (
            <WorkspaceArtifactEmpty
                detail="Binary files cannot be previewed here yet."
                title={target.path}
            />
        );
    }

    if (file.mediaType.startsWith('image/')) {
        return (
            <div className="grid h-full min-h-0 place-items-center overflow-auto bg-muted/20 p-6">
                <img
                    alt={target.path}
                    className="h-auto max-h-full w-auto max-w-full rounded-md border border-border/60 bg-background object-contain shadow-sm"
                    height={768}
                    src={`data:${file.mediaType};base64,${file.content}`}
                    width={1024}
                />
            </div>
        );
    }

    if (file.mediaType === 'text/html') {
        return (
            <iframe
                className="h-full min-h-0 w-full bg-white"
                sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts"
                srcDoc={file.content}
                title={target.path}
            />
        );
    }

    return (
        <SimpleCodeEditor className="h-full" filePath={target.path} readOnly value={file.content} />
    );
}

export function WorkspaceArtifactEmpty({ detail, title }: { detail: string; title: string }) {
    return (
        <div className="grid h-full min-h-0 place-items-center px-8 text-center">
            <div className="max-w-sm">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/35">
                    <Icon className="size-4 text-muted-foreground" icon={File01Icon} />
                </div>
                <div className="truncate font-medium text-sm">{title}</div>
                <div className="mt-1 text-muted-foreground text-sm leading-6">{detail}</div>
            </div>
        </div>
    );
}
