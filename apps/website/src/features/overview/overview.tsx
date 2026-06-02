import { usePrimaryAgent } from '../../hooks/agents/use-agent-list.ts';
import { useCronList } from '../../hooks/cron/use-cron-list.ts';
import { useSessionList } from '../../hooks/sessions/use-session-list.ts';
import { useWorkerList } from '../../hooks/workers/use-worker-list.ts';
import { OverviewView } from './overview-view.tsx';

export function Overview() {
    const primaryAgentQuery = usePrimaryAgent();
    const agent = primaryAgentQuery.data?.agent ?? null;
    const sessionsQuery = useSessionList();
    const workersQuery = useWorkerList();
    const cronJobsQuery = useCronList();

    return (
        <OverviewView
            agent={agent}
            heading="The Tavern is quiet tonight, Zach."
            jobCount={cronJobsQuery.data?.jobs.length ?? 0}
            memoryCount={0}
            sessionsCount={sessionsQuery.data?.sessions.length ?? 0}
            workerCount={workersQuery.data?.workers.length ?? 0}
        />
    );
}
