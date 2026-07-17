import * as React from 'react';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useAgentPresence } from '../../hooks/agents/use-agent-presence.ts';
import { useModelList } from '../../hooks/models/use-model-list.ts';
import { useUserProfilePreference } from '../../hooks/shell/use-user-profile-preference.ts';
import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';
import { buildOverviewActivityFeed } from './overview-activity.ts';
import { buildOverviewGreeting, buildOverviewHeading } from './overview-heading.ts';
import { OverviewView } from './overview-view.tsx';

export function Overview() {
    const agentsQuery = useAgentList();
    const presenceQuery = useAgentPresence();
    const modelsQuery = useModelList();
    const relativeNow = useRelativeNow();
    const { displayName } = useUserProfilePreference();
    const agents = agentsQuery.data?.agents ?? [];
    const phraseSeed = React.useMemo(() => Math.random(), []);

    // One bounded activity read per agent (specs/agent-activity.md); the page
    // merges them into a single workspace feed plus per-agent sparklines.
    const activityQueries = trpc.useQueries((query) =>
        agents.map((agent) =>
            query.agent.activity({ agentId: agent.id, limit: 50 }, queryPolicy.volatileState)
        )
    );
    const feed = buildOverviewActivityFeed(
        agents.map((agent, index) => ({
            agentId: agent.id,
            entries: activityQueries[index]?.data?.entries ?? [],
        })),
        relativeNow
    );
    const modelRefByAgentId = new Map<string, string | null>(
        (modelsQuery.data?.agents ?? []).map((entry) => [entry.agentId, entry.modelRef ?? null])
    );

    return (
        <OverviewView
            activity={feed.items}
            activitySeriesByAgentId={feed.seriesByAgentId}
            agents={agents}
            greeting={buildOverviewGreeting({ name: displayName })}
            heading={buildOverviewHeading({ phraseSeed })}
            modelRefByAgentId={modelRefByAgentId}
            now={relativeNow}
            presence={presenceQuery.data?.presence ?? []}
        />
    );
}
