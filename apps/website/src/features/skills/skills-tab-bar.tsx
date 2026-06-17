import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx';

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
        <Tabs
            aria-label="Filter skills"
            className="self-start"
            onValueChange={(nextValue) => onChange(nextValue as SkillsTab)}
            value={value}
        >
            <TabsList>
                {tabs.map((tab) => (
                    <TabsTrigger key={tab.id} size="sm" value={tab.id}>
                        <span>{tab.label}</span>
                        {counts[tab.id] === undefined ? null : (
                            <span className="font-mono text-muted-foreground text-xs tabular-nums">
                                {counts[tab.id]}
                            </span>
                        )}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}
