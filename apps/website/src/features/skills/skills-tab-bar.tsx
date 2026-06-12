import { cn } from '../../lib/utils.ts';

export type SkillsTab = 'available' | 'installed';

const tabs: Array<{ id: SkillsTab; label: string }> = [
    { id: 'installed', label: 'Installed' },
    { id: 'available', label: 'Available' },
];

export function SkillsTabBar({
    counts,
    onChange,
    value,
}: {
    counts: Partial<Record<SkillsTab, number>>;
    onChange: (value: SkillsTab) => void;
    value: SkillsTab;
}) {
    return (
        <div
            aria-label="Filter skills"
            className="flex min-w-0 flex-wrap items-center gap-1 self-start rounded-lg bg-muted/50 p-1"
            role="tablist"
        >
            {tabs.map((tab) => {
                const active = value === tab.id;

                return (
                    <button
                        aria-selected={active}
                        className={cn(
                            'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 font-medium text-muted-foreground text-sm transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active && 'bg-background text-foreground shadow-xs'
                        )}
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        role="tab"
                        type="button"
                    >
                        <span>{tab.label}</span>
                        {counts[tab.id] === undefined ? null : (
                            <span className="font-mono text-muted-foreground text-xs tabular-nums">
                                {counts[tab.id]}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
