import type { AgentListOutput, ChatListOutput, WorkerListOutput } from '../../lib/trpc.tsx';
import { StartChatComposer } from '../chats/start-chat-composer.tsx';
import type { CronListItem } from '../cron/cron-list-data.ts';
import { OverviewActivityFeed } from './overview-activity-feed.tsx';
import { OverviewHeader } from './overview-header.tsx';

interface OverviewViewProps {
    agent: AgentListOutput['agents'][number] | null;
    agents: AgentListOutput['agents'];
    chats: ChatListOutput['chats'];
    heading: string;
    jobCount: number;
    memoryCount: number;
    recentCronJobs: CronListItem[];
    sessionsCount: number;
    workerCount: number;
    workers: WorkerListOutput['workers'];
}

export function OverviewView({
    agent,
    agents,
    chats,
    heading,
    jobCount,
    memoryCount,
    recentCronJobs,
    sessionsCount,
    workers,
    workerCount,
}: OverviewViewProps) {
    return (
        <div className="flex flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-6 pt-16 pb-12">
            <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
                <div className="animate-float-up">
                    <OverviewHeader
                        heading={heading}
                        jobCount={jobCount}
                        memoryCount={memoryCount}
                        sessionsCount={sessionsCount}
                        workerCount={workerCount}
                    />
                </div>

                <div className="w-full animate-float-up [animation-delay:80ms]">
                    <StartChatComposer agent={agent} />
                </div>
                <div className="mt-10 w-full animate-float-up [animation-delay:160ms]">
                    <OverviewActivityFeed
                        agents={agents}
                        chats={chats}
                        recentCronJobs={recentCronJobs}
                        workers={workers}
                    />
                </div>
            </div>
        </div>
    );
}
