import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
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
        <TabsSubtle
            onValueChange={(value) => onFilterChange(value as WorkersFilterType)}
            value={filter}
        >
            <TabsSubtleList>
                {filterTabs.map((item) => (
                    <TabsSubtleItem key={item.id} size="sm" value={item.id}>
                        {item.label}
                    </TabsSubtleItem>
                ))}
            </TabsSubtleList>
        </TabsSubtle>
    );
}
