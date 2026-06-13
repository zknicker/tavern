import * as React from 'react';
import { usePrimaryAgent } from '../../hooks/agents/use-agent-list.ts';
import { useCronList } from '../../hooks/cron/use-cron-list.ts';
import { useSessionList } from '../../hooks/sessions/use-session-list.ts';
import { useWorkerList } from '../../hooks/workers/use-worker-list.ts';
import { buildOverviewHeading } from './overview-heading.ts';
import { OverviewView } from './overview-view.tsx';

export function Overview() {
    const primaryAgentQuery = usePrimaryAgent();
    const agent = primaryAgentQuery.data?.agent ?? null;
    const sessionsQuery = useSessionList();
    const workersQuery = useWorkerList();
    const cronJobsQuery = useCronList();
    const jobs = cronJobsQuery.data?.jobs ?? [];
    const sessions = sessionsQuery.data?.sessions ?? [];
    const workers = workersQuery.data?.workers ?? [];
    const memoryCount = 0;
    const phraseSeed = React.useMemo(() => Math.random(), []);

    return (
        <OverviewView
            agent={agent}
            heading={buildOverviewHeading({ phraseSeed })}
            jobCount={jobs.length}
            memoryCount={memoryCount}
            sessionsCount={sessions.length}
            workerCount={workers.length}
        />
    );
}
