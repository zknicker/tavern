import * as React from 'react';
import { Drawer, DrawerTrigger } from '../../../components/ui/drawer.tsx';
import type { SessionHistoryToolCallOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { ToolBlockSummary } from './tool-block-summary.tsx';
import { ToolDrawer } from './tool-drawer.tsx';
import { hasErrorStatus } from './tool-ui.ts';

export function ToolSummaryCard({
    agentName,
    duration,
    title,
    toolCalls,
}: {
    agentName: string;
    duration: string;
    title: string;
    toolCalls: number;
}) {
    return (
        <button
            className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50"
            type="button"
        >
            <span className="size-1.5 shrink-0 rounded-full bg-success" />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-foreground text-sm">
                        {agentName}
                    </span>
                    <span className="truncate text-muted-foreground text-sm">{title}</span>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground/60 text-xs">
                    <span>{duration}</span>
                    <span>&middot;</span>
                    <span>
                        {toolCalls} {toolCalls === 1 ? 'tool' : 'tools'}
                    </span>
                </span>
            </span>
        </button>
    );
}

export function ToolBlock({
    completedAt,
    sessionKey,
    startedAt,
    toolCall,
}: {
    completedAt: string | null;
    sessionKey: string | null;
    startedAt: string | null;
    toolCall: SessionHistoryToolCallOutput;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const hasError = hasErrorStatus(toolCall.status);
    const toolCallId = toolCall.callId;
    const canInspect = toolCallId !== null && sessionKey !== null;

    return (
        <div className="min-w-0">
            {canInspect ? (
                <Drawer onOpenChange={setIsOpen} open={isOpen} position="right">
                    <DrawerTrigger
                        render={
                            <button
                                aria-expanded={isOpen}
                                className={cn(
                                    'flex w-full items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                                    hasError
                                        ? 'border-red-500/12 bg-red-500/4 hover:bg-red-500/8'
                                        : 'border-border/45 bg-muted/25 hover:bg-muted/45'
                                )}
                                type="button"
                            />
                        }
                    >
                        <ToolBlockSummary
                            completedAt={completedAt}
                            startedAt={startedAt}
                            toolCall={toolCall}
                        />
                    </DrawerTrigger>
                    <ToolDrawer
                        isOpen={isOpen}
                        sessionKey={sessionKey}
                        source="session"
                        toolCallId={toolCallId}
                    />
                </Drawer>
            ) : (
                <div
                    className={cn(
                        'flex items-center gap-2 overflow-hidden rounded-lg border px-3 py-2',
                        hasError ? 'border-red-500/12 bg-red-500/4' : 'border-border/45 bg-muted/25'
                    )}
                >
                    <ToolBlockSummary
                        completedAt={completedAt}
                        startedAt={startedAt}
                        toolCall={toolCall}
                    />
                </div>
            )}
        </div>
    );
}
