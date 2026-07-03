import { Activity, Pause, Play, Plus, Search, Trash2 } from '@hugeicons/core-free-icons';
import { Badge } from '../../../components/ui/badge.tsx';
import { Card, CardContent } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { ScrollArea } from '../../../components/ui/scroll-area.tsx';
import { cn } from '../../../lib/utils.ts';
import type { SubAgentListItem } from './sub-agent-list-data.ts';

interface SubAgentsViewProps {
    subAgents: SubAgentListItem[];
}

const statusColors = {
    active: 'bg-success',
    idle: 'bg-warning',
    stopped: 'bg-destructive',
} satisfies Record<SubAgentListItem['status'], string>;

export function SubAgentsView({ subAgents }: SubAgentsViewProps) {
    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('en-US', {
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            month: 'short',
        });

    return (
        <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                    <Icon
                        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        icon={Search}
                    />
                    <Input className="pl-9" placeholder="Search delegated work..." />
                </div>
                <Button className="gap-2" size="sm">
                    <Icon className="size-4" icon={Plus} />
                    Spawn Sub-Agent
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-3">
                    {subAgents.map((subAgent) => (
                        <Card key={subAgent.id}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <span
                                            className={cn(
                                                'mt-1.5 size-2.5 rounded-full',
                                                statusColors[subAgent.status]
                                            )}
                                        />
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-foreground">
                                                    {subAgent.name}
                                                </span>
                                                <Badge
                                                    variant={statusToBadgeVariant(subAgent.status)}
                                                >
                                                    {subAgent.status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-muted-foreground text-sm">
                                                <span className="flex items-center gap-1">
                                                    <Icon className="size-3.5" icon={Activity} />
                                                    {subAgent.taskCount} tasks completed
                                                </span>
                                                <span>
                                                    Created: {formatDate(subAgent.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {subAgent.status === 'active' ? (
                                            <Button size="icon-sm" variant="ghost">
                                                <Icon className="size-4" icon={Pause} />
                                            </Button>
                                        ) : (
                                            <Button size="icon-sm" variant="ghost">
                                                <Icon className="size-4" icon={Play} />
                                            </Button>
                                        )}
                                        <Button size="icon-sm" variant="destructive-outline">
                                            <Icon className="size-4" icon={Trash2} />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {subAgents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-muted-foreground">No delegated work yet</p>
                            <p className="mt-1 text-muted-foreground text-sm">
                                Delegated work will appear here when created
                            </p>
                        </div>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    );
}

function statusToBadgeVariant(status: SubAgentListItem['status']) {
    switch (status) {
        case 'active':
            return 'success';
        case 'idle':
            return 'warning';
        case 'stopped':
            return 'destructive';
        default:
            return 'secondary';
    }
}
