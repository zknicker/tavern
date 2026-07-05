import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { SettingsGroup, SettingsSection } from '../../../components/ui/settings-row.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { useMemoryTimeline, useMemoryWorkers } from '../../../hooks/memory/use-memory-workers.ts';
import { WorkerReportDrawer } from './worker-report-drawer.tsx';
import { WorkerTable } from './worker-table.tsx';
import { WorkerTimeline } from './worker-timeline.tsx';

export function BackgroundWorkSection() {
    const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
    const workersQuery = useMemoryWorkers();
    const timelineQuery = useMemoryTimeline();

    const workers = workersQuery.data?.workers ?? [];
    const jobs = timelineQuery.data?.jobs ?? [];
    const error = workersQuery.error?.message ?? null;

    return (
        <SettingsSection title="Background work">
            <SettingsGroup>
                {renderWorkers({
                    error,
                    isLoading: workersQuery.isPending,
                    workers,
                })}
            </SettingsGroup>

            <BadgeDivider className="pt-2 pb-3">Runs over time</BadgeDivider>
            <SettingsGroup>
                {timelineQuery.isPending ? (
                    <Skeleton className="m-4 h-40 rounded-md" />
                ) : (
                    <WorkerTimeline jobs={jobs} onSelectRun={setSelectedRunId} />
                )}
            </SettingsGroup>

            <WorkerReportDrawer jobId={selectedRunId} onClose={() => setSelectedRunId(null)} />
        </SettingsSection>
    );
}

function renderWorkers({
    error,
    isLoading,
    workers,
}: {
    error: string | null;
    isLoading: boolean;
    workers: React.ComponentProps<typeof WorkerTable>['workers'];
}) {
    if (isLoading) {
        return <Skeleton className="m-3 h-40 rounded-md" />;
    }
    if (error) {
        return (
            <p className="px-4 py-6 text-muted-foreground text-sm">
                Background work is unavailable while the runtime is offline.
            </p>
        );
    }
    return <WorkerTable workers={workers} />;
}
