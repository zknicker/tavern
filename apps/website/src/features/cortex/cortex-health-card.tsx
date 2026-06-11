import type { CortexHealthOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';

const stateCopy = {
    degraded: 'Hub unreachable',
    healthy: 'Cortex healthy',
    needs_attention: 'Needs your call',
} as const;

const stateDotClass = {
    degraded: 'bg-error',
    healthy: 'bg-success',
    needs_attention: 'bg-warning',
} as const;

export function CortexHealthCard({
    health,
    isSelected,
    onOpen,
}: {
    health: CortexHealthOutput | null;
    isSelected: boolean;
    onOpen: () => void;
}) {
    const state = health?.state ?? 'healthy';
    const escalationCount = health?.escalations.length ?? 0;

    return (
        <button
            className={cn(
                'mx-3 mt-4 flex w-[calc(100%-1.5rem)] items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                isSelected
                    ? 'border-border-strong bg-muted/60'
                    : 'border-border/70 bg-muted/25 hover:bg-muted/50'
            )}
            onClick={onOpen}
            type="button"
        >
            <span
                aria-hidden
                className={cn('size-2 shrink-0 rounded-full', stateDotClass[state])}
            />
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground text-sm">
                    {stateCopy[state]}
                </span>
                <span className="block truncate text-muted-foreground text-sm">
                    {escalationCount > 0
                        ? `${escalationCount} escalation${escalationCount === 1 ? '' : 's'} waiting`
                        : health
                          ? `${health.status.topicCount} topics · ${health.status.pageCount} pages`
                          : 'Checking…'}
                </span>
            </span>
        </button>
    );
}
