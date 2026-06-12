import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { CommandLineIcon } from '@hugeicons-pro/core-solid-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Elevated } from '../../components/ui/surface.tsx';
import { useChatDismiss } from '../../hooks/chats/use-chat-dismiss.ts';
import { cn } from '../../lib/utils.ts';
import type { TranscriptRow } from './chat-transcript-model.ts';

type CommandRunRow = Extract<TranscriptRow, { kind: 'system'; systemKind: 'commandRun' }>;

const collapsedLineCount = 8;

/**
 * Durable evidence of a composer slash command: a low-contrast surface card
 * in the timeline with the command name and its monospace output, collapsed
 * past a few lines. Dismissing the card soft-deletes the run from the
 * timeline. See specs/composer-commands.md.
 */
export function CommandRunEntry({ chatId, row }: { chatId?: string; row: CommandRunRow }) {
    const [expanded, setExpanded] = React.useState(false);
    const { dismissRow } = useChatDismiss(chatId);
    const failed = row.commandRun.status === 'failed';
    const output = row.commandRun.output.trim();
    const lines = output ? output.split('\n') : [];
    const collapsible = lines.length > collapsedLineCount;
    const visibleOutput =
        collapsible && !expanded ? lines.slice(0, collapsedLineCount).join('\n') : output;

    return (
        <div className="group relative w-full px-3 py-1">
            <Elevated
                className="w-[min(80%,52rem)] min-w-0 rounded-lg px-3 py-2"
                offset={1}
                shadowLevel={1}
            >
                <div className="flex items-center gap-1.5">
                    <Icon
                        className={cn(
                            'size-3.5 shrink-0',
                            failed ? 'text-destructive' : 'text-muted-foreground'
                        )}
                        icon={CommandLineIcon}
                    />
                    <span className="font-medium font-mono text-[13px] text-foreground leading-4">
                        {row.commandRun.command}
                    </span>
                    {failed ? (
                        <span className="text-[12px] text-destructive leading-4">failed</span>
                    ) : null}
                    {chatId ? (
                        <button
                            aria-label="Dismiss command output"
                            className="ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition-opacity duration-150 hover:text-foreground group-hover:opacity-100"
                            onClick={() => dismissRow(row.commandRun.responseId)}
                            title="Dismiss"
                            type="button"
                        >
                            <Icon className="size-3.5" icon={Cancel01Icon} strokeWidth={2} />
                        </button>
                    ) : null}
                </div>
                {visibleOutput ? (
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] text-muted-foreground leading-snug">
                        {visibleOutput}
                    </pre>
                ) : null}
                {collapsible ? (
                    <button
                        className="mt-1 rounded-md text-[12px] text-muted-foreground leading-4 hover:text-foreground"
                        onClick={() => setExpanded((value) => !value)}
                        type="button"
                    >
                        {expanded ? 'Show less' : `Show all ${lines.length} lines`}
                    </button>
                ) : null}
            </Elevated>
        </div>
    );
}
