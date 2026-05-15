import * as React from 'react';
import {
    useAgentListSuspense,
    usePrimaryAgentSuspense,
} from '../../hooks/agents/use-agent-list.ts';
import { useChatListSuspense } from '../../hooks/chats/use-chat-list.ts';
import { useCronList } from '../../hooks/cron/use-cron-list.ts';
import { useCronRuns } from '../../hooks/cron/use-cron-runs.ts';
import { useSessionListSuspense } from '../../hooks/sessions/use-session-list.ts';
import { useWorkerListSuspense } from '../../hooks/workers/use-worker-list.ts';
import { buildCronList } from '../cron/cron-list-data.ts';
import { OverviewView } from './overview-view.tsx';

export function Overview() {
    const [agents] = useAgentListSuspense();
    const [primaryAgent] = usePrimaryAgentSuspense();
    const agent = primaryAgent.agent;
    const [chats] = useChatListSuspense();
    const [sessionsData] = useSessionListSuspense();
    const [workers] = useWorkerListSuspense();
    const cronJobsQuery = useCronList();
    const cronRunsQuery = useCronRuns({ limit: 8 });
    const cronJobs = React.useMemo(
        () => buildCronList(cronJobsQuery.data?.jobs ?? [], cronRunsQuery.data?.runs ?? []),
        [cronJobsQuery.data?.jobs, cronRunsQuery.data?.runs]
    );

    return (
        <OverviewView
            agent={agent}
            agents={agents.agents}
            chats={chats.chats}
            heading="The Tavern is quiet tonight, Zach."
            jobCount={cronJobsQuery.data?.jobs.length ?? 0}
            memoryCount={0}
            recentCronJobs={cronJobs}
            sessionsCount={sessionsData.sessions.length}
            workerCount={workers.workers.length}
            workers={workers.workers}
        />
    );
}
