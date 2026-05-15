import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LogLevel = 'debug' | 'error' | 'info' | 'verbose' | 'warn';

export interface LogEntry {
    id?: string;
    level: LogLevel;
    message: string;
    timestamp?: string;
}

export interface LevelColors {
    badge: string;
    dot: string;
    text: string;
}

export type LevelColorScale = Partial<Record<LogLevel, Partial<LevelColors>>>;

const defaultLevelColors: Record<LogLevel, LevelColors> = {
    debug: {
        badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
        dot: 'bg-violet-500',
        text: 'text-violet-500 dark:text-violet-400',
    },
    error: {
        badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        dot: 'bg-rose-500',
        text: 'text-rose-500 dark:text-rose-400',
    },
    info: {
        badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
        dot: 'bg-sky-500',
        text: 'text-sky-500 dark:text-sky-400',
    },
    verbose: {
        badge: 'bg-muted text-muted-foreground',
        dot: 'bg-zinc-400 dark:bg-zinc-500',
        text: 'text-zinc-400 dark:text-zinc-500',
    },
    warn: {
        badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        dot: 'bg-amber-500',
        text: 'text-amber-500 dark:text-amber-400',
    },
};

export const levelLabels: Record<LogLevel, string> = {
    debug: 'DBG',
    error: 'ERR',
    info: 'INF',
    verbose: 'VRB',
    warn: 'WRN',
};

export function resolveLevelColors(level: LogLevel, colorScale?: LevelColorScale): LevelColors {
    const defaults = defaultLevelColors[level];
    const overrides = colorScale?.[level];

    if (!overrides) {
        return defaults;
    }

    return {
        badge: overrides.badge ?? defaults.badge,
        dot: overrides.dot ?? defaults.dot,
        text: overrides.text ?? defaults.text,
    };
}

export function filterEntries(entries: LogEntry[], searchQuery: string) {
    if (!searchQuery) {
        return entries;
    }

    const query = searchQuery.toLowerCase();
    return entries.filter((entry) => entry.message.toLowerCase().includes(query));
}

export function formatTimestampFull(timestamp?: string) {
    const date = timestamp ? new Date(timestamp) : new Date();
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    const time = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
        second: '2-digit',
    });

    return `${time}.${ms}`;
}

export function serializeLogs(entries: LogEntry[]) {
    return entries
        .map(
            (entry) =>
                `[${formatTimestampFull(entry.timestamp)}] [${levelLabels[entry.level]}] ${entry.message}`
        )
        .join('\n');
}

export function exportLogs(entries: LogEntry[]) {
    const url = URL.createObjectURL(new Blob([serializeLogs(entries)], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/gu, '-')}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
}

export function useCopy() {
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }, []);

    return { copied, copy };
}

export function useAutoScroll(entryCount: number, enabled: boolean) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    useEffect(() => {
        if (!(enabled && isAtBottom && entryCount >= 0)) {
            return;
        }

        const element = scrollRef.current;
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    }, [enabled, entryCount, isAtBottom]);

    const handleScroll = useCallback(() => {
        const element = scrollRef.current;
        if (!element) {
            return;
        }

        setIsAtBottom(element.scrollHeight - element.scrollTop - element.clientHeight < 40);
    }, []);

    const scrollToBottom = useCallback(() => {
        const element = scrollRef.current;
        if (!element) {
            return;
        }

        element.scrollTop = element.scrollHeight;
        setIsAtBottom(true);
    }, []);

    return {
        handleScroll,
        isAtBottom,
        scrollRef,
        scrollToBottom,
    };
}

export function highlightSearch(text: string, searchQuery: string): React.ReactNode {
    if (!searchQuery) {
        return text;
    }

    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'giu'));
    let offset = 0;

    return parts.map((part) => {
        const key = `${offset}:${part}`;
        offset += part.length;

        return part.toLowerCase() === searchQuery.toLowerCase() ? (
            <mark className="rounded-sm bg-warning/24 px-0.5 text-inherit" key={key}>
                {part}
            </mark>
        ) : (
            part
        );
    });
}
