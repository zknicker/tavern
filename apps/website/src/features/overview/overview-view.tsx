import type { AgentListOutput, AgentPresenceOutput } from '../../lib/trpc.tsx';
import type { OverviewActivityItem } from './overview-activity.ts';
import { OverviewHeader } from './overview-header.tsx';
import type { OverviewGreetingParts } from './overview-heading.ts';
import { OverviewActivity, OverviewAgentCards } from './overview-sections.tsx';

interface OverviewViewProps {
    activity: OverviewActivityItem[];
    activitySeriesByAgentId: Map<string, number[]>;
    agents: AgentListOutput['agents'];
    greeting: OverviewGreetingParts;
    heading: string;
    modelRefByAgentId: Map<string, string | null>;
    now: number;
    presence: AgentPresenceOutput['presence'];
}

export function OverviewView({
    activity,
    activitySeriesByAgentId,
    agents,
    greeting,
    heading,
    modelRefByAgentId,
    now,
    presence,
}: OverviewViewProps) {
    return (
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
            <div className="relative z-10 w-full max-w-6xl px-10 pt-4 pb-16">
                <div className="animate-float-up">
                    <OverviewHeader greeting={greeting} heading={heading} />
                </div>

                <div className="mt-6 animate-float-up [animation-delay:80ms]">
                    <OverviewAgentCards
                        agents={agents}
                        modelRefByAgentId={modelRefByAgentId}
                        presence={presence}
                        seriesByAgentId={activitySeriesByAgentId}
                    />
                </div>

                <div className="mt-4 animate-float-up [animation-delay:140ms]">
                    <OverviewActivity activity={activity} agents={agents} now={now} />
                </div>
            </div>
        </div>
    );
}
