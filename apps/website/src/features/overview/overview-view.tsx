import { Activity03Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import type { AgentListOutput, AgentPresenceOutput } from '../../lib/trpc.tsx';
import { ContentTopbar } from '../shell/content-topbar.tsx';
import { HomeCanvas } from './home-canvas.tsx';
import type { OverviewActivityItem } from './overview-activity.ts';
import { OverviewActivity, OverviewAgentCards } from './overview-sections.tsx';

interface OverviewViewProps {
    activity: OverviewActivityItem[];
    activitySeriesByAgentId: Map<string, number[]>;
    agents: AgentListOutput['agents'];
    modelRefByAgentId: Map<string, string | null>;
    now: number;
    presence: AgentPresenceOutput['presence'];
}

export function OverviewView({
    activity,
    activitySeriesByAgentId,
    agents,
    modelRefByAgentId,
    now,
    presence,
}: OverviewViewProps) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <ContentTopbar>
                <Icon
                    aria-hidden="true"
                    className="size-4.5 text-muted-foreground"
                    icon={Activity03Icon}
                    size={20}
                />
                <h1 className="font-semibold text-foreground text-sm">Activity</h1>
            </ContentTopbar>
            <OverviewBody
                activity={activity}
                activitySeriesByAgentId={activitySeriesByAgentId}
                agents={agents}
                modelRefByAgentId={modelRefByAgentId}
                now={now}
                presence={presence}
            />
        </div>
    );
}

function OverviewBody({
    activity,
    activitySeriesByAgentId,
    agents,
    modelRefByAgentId,
    now,
    presence,
}: OverviewViewProps) {
    return (
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
            <div className="relative z-10 w-full max-w-6xl px-10 pt-4 pb-16">
                <div className="animate-float-up">
                    <HomeCanvas agents={agents} />
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
