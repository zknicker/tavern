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
            className="flex min-w-0 flex-wrap items-center gap-1 self-start"
            role="tablist"
        >
            {tabs.map((tab) => {
                const active = value === tab.id;

                return (
                    <button
                        aria-selected={active}
                        className={cn(
                            'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active
                                ? 'bg-secondary text-secondary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
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
