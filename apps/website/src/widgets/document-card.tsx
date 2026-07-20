import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { WidgetDocumentProps } from '@tavern/api';
import { Icon } from '../components/ui/icon.tsx';
import { useArtifactPanelOpen } from '../features/chats/artifact-panel-context.tsx';
import { cn } from '../lib/utils.ts';

export function WidgetDocumentCard({ props }: { props: WidgetDocumentProps }) {
    const openArtifactPanel = useArtifactPanelOpen();
    const fileName = props.path.split('/').at(-1) ?? props.path;
    const title = props.title ?? fileName.replace(/\.md$/iu, '');

    return (
        <button
            className={cn(
                'group flex w-full max-w-[28rem] items-center gap-3 rounded-lg border border-border bg-surface-2/65 px-3.5 py-3 text-left transition-colors',
                openArtifactPanel
                    ? 'cursor-pointer hover:border-border-strong hover:bg-surface-3/70'
                    : 'cursor-default'
            )}
            onClick={() => openArtifactPanel?.({ kind: 'wikiPage', path: props.path })}
            type="button"
        >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/35">
                <Icon className="size-4 text-muted-foreground" icon={File01Icon} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground text-sm leading-5">
                    {title}
                </span>
                <span className="block truncate text-muted-foreground text-xs leading-5">
                    Wiki document · {props.path}
                </span>
            </span>
            <span className="shrink-0 text-muted-foreground text-xs group-hover:text-foreground">
                Open
            </span>
        </button>
    );
}
