import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx';
import type { WorkersFilterType } from './filter-workers.ts';

const filterTabs = [
    { id: 'all', label: 'All' },
    { id: 'cron', label: 'Cron' },
    { id: 'acp', label: 'ACP' },
    { id: 'subagent', label: 'Delegated' },
    { id: 'cli', label: 'CLI' },
] satisfies Array<{ id: WorkersFilterType; label: string }>;

interface WorkersFilterTabsProps {
    filter: WorkersFilterType;
    onFilterChange: (filter: WorkersFilterType) => void;
}

export function WorkersFilterTabs({ filter, onFilterChange }: WorkersFilterTabsProps) {
    return (
        <Tabs onValueChange={(value) => onFilterChange(value as WorkersFilterType)} value={filter}>
            <TabsList>
                {filterTabs.map((item) => (
                    <TabsTrigger key={item.id} size="sm" value={item.id}>
                        {item.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}
