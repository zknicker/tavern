import {
    ArrowDown01Icon,
    Cancel01Icon,
    Copy01Icon,
    Delete02Icon,
    Download01Icon,
    PauseIcon,
    PlayIcon,
    Search01Icon,
    TerminalIcon,
    Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import {
    exportLogs,
    filterEntries,
    formatTimestampFull,
    highlightSearch,
    type LevelColorScale,
    type LogEntry,
    levelLabels,
    resolveLevelColors,
    serializeLogs,
    useAutoScroll,
    useCopy,
} from './log-viewer-utils.tsx';
import { ScrollAreaPrimitive, ScrollBar } from './scroll-area.tsx';

export type { LevelColorScale, LogEntry, LogLevel } from './log-viewer-utils.tsx';

interface LogViewerTerminalProps extends Omit<React.ComponentProps<'div'>, 'children' | 'title'> {
    autoScroll?: boolean;
    colorScale?: LevelColorScale;
    entries: LogEntry[];
    lineNumbers?: boolean;
    maxHeight?: number;
    onClear?: () => void;
    timestamps?: boolean;
    title?: string;
}

export function LogViewerTerminal({
    autoScroll = true,
    className,
    colorScale,
    entries,
    lineNumbers = true,
    maxHeight = 400,
    onClear,
    timestamps = true,
    title = 'Logs',
    ...props
}: LogViewerTerminalProps) {
    const [paused, setPaused] = React.useState(false);
    const [searchOpen, setSearchOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const { copied, copy } = useCopy();
    const { handleScroll, isAtBottom, scrollRef, scrollToBottom } = useAutoScroll(
        entries.length,
        autoScroll && !paused
    );
    const filteredEntries = filterEntries(entries, searchQuery);
    const lineNumberWidth = Math.max(String(entries.length).length, 3);

    return (
        <div
            className={cn(
                'flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm',
                className
            )}
            data-slot="log-viewer-terminal"
            {...props}
        >
            <div className="flex min-h-10 items-center gap-2 border-border/40 border-b bg-muted/30 px-3 py-2">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" icon={TerminalIcon} />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
                    {title}
                </span>
                <span className="mr-1 whitespace-nowrap font-mono text-micro text-muted-foreground tabular-nums">
                    {filteredEntries.length}
                    {searchQuery ? ` / ${entries.length}` : null} lines
                </span>
                <div className="flex items-center gap-0.5">
                    <ToolbarButton
                        active={searchOpen}
                        label={searchOpen ? 'Close search' : 'Search logs'}
                        onClick={() => {
                            setSearchOpen((value) => !value);
                            if (searchOpen) {
                                setSearchQuery('');
                            }
                        }}
                    >
                        <Icon className="size-3.5" icon={Search01Icon} />
                    </ToolbarButton>
                    <ToolbarButton
                        active={paused}
                        label={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
                        onClick={() => setPaused((value) => !value)}
                    >
                        <Icon className="size-3.5" icon={paused ? PlayIcon : PauseIcon} />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copied ? 'Copied logs' : 'Copy logs'}
                        onClick={() => copy(serializeLogs(entries))}
                    >
                        <Icon
                            className={cn('size-3.5', copied && 'text-success')}
                            icon={copied ? Tick02Icon : Copy01Icon}
                        />
                    </ToolbarButton>
                    <ToolbarButton label="Download logs" onClick={() => exportLogs(entries)}>
                        <Icon className="size-3.5" icon={Download01Icon} />
                    </ToolbarButton>
                    {onClear ? (
                        <ToolbarButton label="Clear logs" onClick={onClear}>
                            <Icon className="size-3.5" icon={Delete02Icon} />
                        </ToolbarButton>
                    ) : null}
                </div>
            </div>

            {searchOpen ? (
                <div className="flex items-center gap-2 border-border/40 border-b bg-muted/15 px-3 py-1.5">
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" icon={Search01Icon} />
                    <input
                        autoFocus
                        className="min-w-0 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Filter logs..."
                        type="text"
                        value={searchQuery}
                    />
                    {searchQuery ? (
                        <button
                            aria-label="Clear search"
                            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            onClick={() => setSearchQuery('')}
                            type="button"
                        >
                            <Icon className="size-3" icon={Cancel01Icon} />
                        </button>
                    ) : null}
                </div>
            ) : null}

            <ScrollAreaPrimitive.Root
                className="min-h-0 bg-card"
                style={{
                    maxHeight,
                }}
            >
                <ScrollAreaPrimitive.Viewport
                    aria-label={title}
                    aria-live="polite"
                    className="max-h-[inherit] min-h-0 font-mono text-xs leading-relaxed outline-none [scrollbar-width:thin]"
                    onScroll={handleScroll}
                    ref={scrollRef}
                    role="log"
                >
                    {filteredEntries.length === 0 ? (
                        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                            {searchQuery ? 'No matching log entries.' : 'No log entries.'}
                        </div>
                    ) : (
                        filteredEntries.map((entry, index) => {
                            const colors = resolveLevelColors(entry.level, colorScale);

                            return (
                                <div
                                    className="flex gap-3 border-border/20 border-b px-3 py-1 transition-colors hover:bg-muted/30"
                                    key={
                                        entry.id ??
                                        `${entry.timestamp ?? 'no-timestamp'}:${entry.level}:${entry.message}:${index}`
                                    }
                                >
                                    {lineNumbers ? (
                                        <span
                                            aria-hidden="true"
                                            className="shrink-0 select-none text-right text-muted-foreground/50"
                                            style={{
                                                width: `${lineNumberWidth}ch`,
                                            }}
                                        >
                                            {index + 1}
                                        </span>
                                    ) : null}
                                    {timestamps ? (
                                        <span className="shrink-0 text-muted-foreground/60">
                                            {formatTimestampFull(entry.timestamp)}
                                        </span>
                                    ) : null}
                                    <span
                                        className={cn(
                                            'w-[3ch] shrink-0 text-right font-semibold',
                                            colors.text
                                        )}
                                    >
                                        {levelLabels[entry.level]}
                                    </span>
                                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-all text-foreground/90">
                                        {highlightSearch(entry.message, searchQuery)}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </ScrollAreaPrimitive.Viewport>
                <ScrollBar orientation="vertical" />
                <ScrollBar orientation="horizontal" />
                <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
            </ScrollAreaPrimitive.Root>

            {isAtBottom ? null : (
                <button
                    aria-label="Scroll to latest"
                    className="flex w-full items-center justify-center gap-1.5 border-border/40 border-t bg-muted/30 py-1.5 font-medium text-micro text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    onClick={scrollToBottom}
                    type="button"
                >
                    <Icon className="size-3" icon={ArrowDown01Icon} />
                    New logs below
                </button>
            )}
        </div>
    );
}

function ToolbarButton({
    active = false,
    children,
    label,
    onClick,
}: {
    active?: boolean;
    children: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            aria-label={label}
            className={cn(
                'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                active && 'bg-accent text-accent-foreground'
            )}
            onClick={onClick}
            type="button"
        >
            {children}
        </button>
    );
}
