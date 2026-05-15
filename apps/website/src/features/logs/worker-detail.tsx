import { ExternalLink, Trash2, Zap } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table.tsx';
import type { WorkerRecord } from './worker-records.ts';

export function WorkerDetail({ worker }: { worker: WorkerRecord | null }) {
    if (!worker) {
        return (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
                Select a task to view details
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1">
            <div className="p-6">
                <div className="mb-6">
                    <p className="mb-2 text-foreground text-sm">{worker.name.replace('...', '')}</p>
                    <div className="flex items-center gap-3 text-muted-foreground text-xs">
                        <span>{worker.channel}</span>
                        <span>-</span>
                        <span>{worker.duration}</span>
                        <span>-</span>
                        <span>{worker.completedAt}</span>
                        <span>-</span>
                        <span>{worker.toolCount} tool calls</span>
                    </div>
                </div>

                <div className="mb-6 flex gap-2">
                    <Button size="icon-sm" variant="ghost">
                        <Icon className="size-3.5" icon={Zap} />
                    </Button>
                    <Button size="icon-sm" variant="ghost">
                        <Icon className="size-3.5" icon={ExternalLink} />
                    </Button>
                    <Button size="icon-sm" variant="ghost">
                        <Icon className="size-3.5" icon={Trash2} />
                    </Button>
                </div>

                {worker.result ? (
                    <div className="space-y-6">
                        <div>
                            <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                                Result
                            </p>
                            <h2 className="font-semibold text-foreground text-lg">
                                {worker.result.title}
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                <span className="font-medium">Period:</span> {worker.result.period}{' '}
                                | <span className="font-medium">Focus:</span> {worker.result.focus}
                            </p>
                        </div>

                        <div>
                            <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground text-sm">
                                <span className="text-base">DETAILS</span>
                            </h3>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">
                                            Metric
                                        </TableHead>
                                        <TableHead className="text-muted-foreground">
                                            Value
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {worker.result.metrics.map((metric) => (
                                        <TableRow className="border-border" key={metric.metric}>
                                            <TableCell className="text-foreground">
                                                {metric.metric}
                                            </TableCell>
                                            <TableCell className="text-foreground">
                                                {metric.value}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : null}
            </div>
        </ScrollArea>
    );
}
