import { usePrimaryAgentSuspense } from '../../hooks/agents/use-agent-list.ts';
import { useCronList } from '../../hooks/cron/use-cron-list.ts';
import { useSessionListSuspense } from '../../hooks/sessions/use-session-list.ts';
import { useWorkerListSuspense } from '../../hooks/workers/use-worker-list.ts';
import { OverviewView } from './overview-view.tsx';

export function Overview() {
    const [primaryAgent] = usePrimaryAgentSuspense();
    const agent = primaryAgent.agent;
    const [sessionsData] = useSessionListSuspense();
    const [workers] = useWorkerListSuspense();
    const cronJobsQuery = useCronList();

    return (
        <OverviewView
            agent={agent}
            heading="The Tavern is quiet tonight, Zach."
            jobCount={cronJobsQuery.data?.jobs.length ?? 0}
            memoryCount={0}
            sessionsCount={sessionsData.sessions.length}
            workerCount={workers.workers.length}
        />
    );
}
