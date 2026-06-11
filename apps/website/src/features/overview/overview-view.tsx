import type { AgentListOutput } from '../../lib/trpc.tsx';
import { StartChatComposer } from '../chats/start-chat-composer.tsx';
import { OverviewHeader } from './overview-header.tsx';

interface OverviewViewProps {
    agent: AgentListOutput['agents'][number] | null;
    heading: string;
    jobCount: number;
    memoryCount: number;
    receipt: null | string;
    receiptTo?: null | string;
    sessionsCount: number;
    workerCount: number;
}

export function OverviewView({
    agent,
    heading,
    jobCount,
    memoryCount,
    receipt,
    receiptTo,
    sessionsCount,
    workerCount,
}: OverviewViewProps) {
    return (
        <div className="flex flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-6 pt-[28vh] pb-12">
            <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
                <div className="animate-float-up">
                    <OverviewHeader
                        heading={heading}
                        jobCount={jobCount}
                        memoryCount={memoryCount}
                        receipt={receipt}
                        receiptTo={receiptTo}
                        sessionsCount={sessionsCount}
                        workerCount={workerCount}
                    />
                </div>

                <div className="w-full animate-float-up [animation-delay:80ms]">
                    <StartChatComposer agent={agent} />
                </div>
            </div>
        </div>
    );
}
