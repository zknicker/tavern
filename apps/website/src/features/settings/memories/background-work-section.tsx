import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { SettingsGroup, SettingsSection } from '../../../components/ui/settings-row.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { useMemoryActivity, useMemoryTimeline } from '../../../hooks/memory/use-memory-activity.ts';
import { MemoryActivityTable } from './memory-activity-table.tsx';
import { MemoryRunReportDrawer } from './memory-run-report-drawer.tsx';
import { MemoryRunTimeline } from './memory-run-timeline.tsx';

export function BackgroundWorkSection() {
    const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
    const activityQuery = useMemoryActivity();
    const timelineQuery = useMemoryTimeline();

    const activities = activityQuery.data?.activities ?? [];
    const jobs = timelineQuery.data?.jobs ?? [];
    const error = activityQuery.error?.message ?? null;

    return (
        <SettingsSection title="Background work">
            <SettingsGroup>
                {renderActivity({
                    activities,
                    error,
                    isLoading: activityQuery.isPending,
                })}
            </SettingsGroup>

            <BadgeDivider className="pt-2 pb-3">Runs over time</BadgeDivider>
            <SettingsGroup>
                {timelineQuery.isPending ? (
                    <Skeleton className="m-4 h-40 rounded-md" />
                ) : (
                    <MemoryRunTimeline jobs={jobs} onSelectRun={setSelectedRunId} />
                )}
            </SettingsGroup>

            <MemoryRunReportDrawer jobId={selectedRunId} onClose={() => setSelectedRunId(null)} />
        </SettingsSection>
    );
}

function renderActivity({
    activities,
    error,
    isLoading,
}: {
    activities: React.ComponentProps<typeof MemoryActivityTable>['activities'];
    error: string | null;
    isLoading: boolean;
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
    return <MemoryActivityTable activities={activities} />;
}
