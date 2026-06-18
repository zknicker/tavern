import { Badge } from '../../components/ui/badge.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';

export type ChatSourceFilter = 'all' | string;

export interface ChatSourceFilterOption {
    count: number;
    kind: ChatSourceFilter;
    label: string;
}

const sourceFilterOrder = ['tavern', 'discord', 'cron', 'acp', 'cli', 'subagent', 'internal'];

interface ChatSourceFilterTabsProps {
    filter: ChatSourceFilter;
    onFilterChange: (filter: ChatSourceFilter) => void;
    options: ChatSourceFilterOption[];
}

export function ChatSourceFilterTabs({
    filter,
    onFilterChange,
    options,
}: ChatSourceFilterTabsProps) {
    return (
        <TabsSubtle onValueChange={onFilterChange} value={filter}>
            <TabsSubtleList className="max-w-full overflow-x-auto pb-1">
                {options.map((option) => (
                    <TabsSubtleItem key={option.kind} size="sm" value={option.kind}>
                        {option.label}
                        <Badge size="sm" variant="secondary">
                            {option.count}
                        </Badge>
                    </TabsSubtleItem>
                ))}
            </TabsSubtleList>
        </TabsSubtle>
    );
}

export function buildChatSourceFilterOptions(
    chats: Array<{ source: { kind: string; label: string } }>
) {
    const countsByKind = new Map<string, { count: number; label: string }>();

    for (const chat of chats) {
        const existing = countsByKind.get(chat.source.kind);
        countsByKind.set(chat.source.kind, {
            count: (existing?.count ?? 0) + 1,
            label: existing?.label ?? chat.source.label,
        });
    }

    const sourceOptions = [...countsByKind.entries()]
        .map(([kind, entry]) => ({ kind, ...entry }))
        .sort(
            (left, right) =>
                getSourceFilterOrder(left.kind) - getSourceFilterOrder(right.kind) ||
                left.label.localeCompare(right.label)
        );

    return [{ count: chats.length, kind: 'all', label: 'All' }, ...sourceOptions];
}

function getSourceFilterOrder(kind: string) {
    const index = sourceFilterOrder.indexOf(kind);

    return index === -1 ? sourceFilterOrder.length : index;
}
