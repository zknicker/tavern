import { usePrimaryAgentSuspense } from '../../hooks/agents/use-agent-list.ts';
import { useCronList } from '../../hooks/cron/use-cron-list.ts';
import { useSessionListSuspense } from '../../hooks/sessions/use-session-list.ts';
import { useWorkerListSuspense } from '../../hooks/workers/use-worker-list.ts';
import { OverviewHeader } from '../overview/overview-header.tsx';
import { StartChatComposer } from './start-chat-composer.tsx';

export function NewChat() {
    const [primaryAgent] = usePrimaryAgentSuspense();
    const agent = primaryAgent.agent;
    const [sessionsData] = useSessionListSuspense();
    const [workers] = useWorkerListSuspense();
    const cronJobsQuery = useCronList();

    return (
        <div className="flex flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-6 pt-16 pb-12">
            <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
                <div className="animate-float-up">
                    <OverviewHeader
                        heading="Tavern is quiet tonight, Zach."
                        jobCount={cronJobsQuery.data?.jobs.length ?? 0}
                        memoryCount={0}
                        sessionsCount={sessionsData.sessions.length}
                        workerCount={workers.workers.length}
                    />
                </div>

                <div className="w-full animate-float-up [animation-delay:80ms]">
                    <StartChatComposer agent={agent} />
                </div>
            </div>
        </div>
    );
}
