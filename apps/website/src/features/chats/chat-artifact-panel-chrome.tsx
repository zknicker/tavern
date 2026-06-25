import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { Cancel01Icon, File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { CloseableTab } from '../../components/ui/closeable-tab.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { cn } from '../../lib/utils.ts';
import { ArtifactPanelPathBar } from './chat-artifact-panel-path-bar.tsx';
import { ArtifactPanelSourceMenu } from './chat-artifact-panel-source-menu.tsx';
import {
    getArtifactPanelTargetKey,
    getArtifactPanelTargetLabel,
    type TavernResourceTarget,
} from './tavern-resource-link.ts';

export function ArtifactPanelChrome({
    activeKey,
    activeTarget,
    agentId,
    onClose,
    onCloseTarget,
    onOpenTarget,
    targets,
}: {
    activeKey: string | null;
    activeTarget?: TavernResourceTarget;
    agentId: string;
    onClose: () => void;
    onCloseTarget: (key: string) => void;
    onOpenTarget: (target: TavernResourceTarget) => void;
    targets: TavernResourceTarget[];
}) {
    return (
        <div className="shrink-0 border-border/70 border-b">
            <div className="flex h-10 items-center gap-2 px-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <ScrollArea className="h-7 min-w-0 flex-1" orientation="horizontal">
                        <TabsPrimitive.List
                            aria-label="Open artifacts"
                            className="flex h-7 w-max min-w-full items-center gap-1"
                        >
                            {targets.map((target) => {
                                const key = getArtifactPanelTargetKey(target);
                                return (
                                    <ArtifactPanelTab
                                        active={key === activeKey}
                                        key={key}
                                        onClose={() => onCloseTarget(key)}
                                        target={target}
                                        value={key}
                                    />
                                );
                            })}
                        </TabsPrimitive.List>
                    </ScrollArea>
                    <ArtifactPanelSourceMenu agentId={agentId} onOpenTarget={onOpenTarget} />
                </div>
                <Button
                    aria-label="Close Artifacts"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={onClose}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                >
                    <Icon className="size-3.5" icon={Cancel01Icon} />
                </Button>
            </div>
            {activeTarget ? (
                <ArtifactPanelPathBar onOpenTarget={onOpenTarget} target={activeTarget} />
            ) : null}
        </div>
    );
}

function ArtifactPanelTab({
    active,
    onClose,
    target,
    value,
}: {
    active: boolean;
    onClose: () => void;
    target: TavernResourceTarget;
    value: string;
}) {
    const label = getArtifactPanelTargetLabel(target);

    return (
        <CloseableTab
            className="min-w-0 max-w-40 shrink-0"
            closeLabel={`Close ${label}`}
            onClose={onClose}
        >
            <TabsPrimitive.Tab
                className={cn(
                    'flex h-7 w-full min-w-0 items-center gap-1.5 rounded-lg py-0 pr-7 pl-2.5 text-[0.8125rem] outline-none transition-[background-color,box-shadow,color] focus-visible:bg-muted/56',
                    active
                        ? 'bg-muted/90 text-foreground shadow-black/4 shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/42 hover:text-foreground'
                )}
                title={target.path}
                value={value}
            >
                <Icon aria-hidden="true" className="size-3.5 shrink-0" icon={File01Icon} />
                <span className="min-w-0 truncate">{label}</span>
            </TabsPrimitive.Tab>
        </CloseableTab>
    );
}
