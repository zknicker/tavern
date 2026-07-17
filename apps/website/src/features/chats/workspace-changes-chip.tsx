import { FileEditIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Drawer, DrawerTrigger } from '../../components/ui/drawer.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { ToolDrawer } from '../sessions/tools/tool-drawer.tsx';
import type { ToolStepRow } from './tool-steps/types.ts';

// Timeline affordance for turn file-change evidence: a compact card under the
// agent's reply proving the turn really touched files. Opens the same
// Workspace Changes drawer as the turn-details row.
export function WorkspaceChangesChip({ chatId, row }: { chatId?: string; row: ToolStepRow }) {
    const [open, setOpen] = React.useState(false);
    const label = row.toolCall.label || 'Changed files';

    return (
        <div className="w-full max-w-[34rem] py-0.5">
            <Drawer onOpenChange={setOpen} open={open} position="right">
                <DrawerTrigger
                    render={
                        <button
                            aria-label={`${label} — view diffs`}
                            className={cn(
                                'group/files-chip flex w-full min-w-0 cursor-default items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2 text-left outline-none transition-colors',
                                'hover:border-border focus-visible:ring-2 focus-visible:ring-ring'
                            )}
                            type="button"
                        />
                    }
                >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/40">
                        <Icon
                            className="size-4 text-muted-foreground"
                            icon={FileEditIcon}
                            strokeWidth={1.5}
                        />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground/90 text-sm">
                        {label}
                    </span>
                    <span className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground text-xs transition-colors group-hover/files-chip:border-border group-hover/files-chip:text-foreground/80">
                        View changes
                    </span>
                </DrawerTrigger>
                {chatId ? (
                    <ToolDrawer activityId={row.id} chatId={chatId} isOpen={open} source="chat" />
                ) : null}
            </Drawer>
        </div>
    );
}

export function isWorkspaceChangesToolRow(row: { kind: string; toolCall?: { name: string } }) {
    return row.kind === 'tool' && row.toolCall?.name === 'workspace_changes';
}
