import * as React from 'react';
import { usePrimaryAgent } from '../../hooks/agents/use-agent-list.ts';
import { useCronList } from '../../hooks/cron/use-cron-list.ts';
import { useHighlightList } from '../../hooks/highlights/use-highlight-list.ts';
import { useSessionList } from '../../hooks/sessions/use-session-list.ts';
import { useWorkerList } from '../../hooks/workers/use-worker-list.ts';
import type { HighlightListOutput } from '../../lib/trpc.tsx';
import { buildOverviewHeading } from './overview-heading.ts';
import { OverviewView } from './overview-view.tsx';

export function Overview() {
    const primaryAgentQuery = usePrimaryAgent();
    const agent = primaryAgentQuery.data?.agent ?? null;
    const sessionsQuery = useSessionList();
    const workersQuery = useWorkerList();
    const cronJobsQuery = useCronList();
    const highlightsQuery = useHighlightList();
    const jobs = cronJobsQuery.data?.jobs ?? [];
    const highlights = highlightsQuery.data?.highlights ?? [];
    const sessions = sessionsQuery.data?.sessions ?? [];
    const workers = workersQuery.data?.workers ?? [];
    const memoryCount = 0;
    const phraseSeed = React.useMemo(() => Math.random(), []);
    const selectedHighlight = React.useMemo(() => pickLandingHighlight(highlights), [highlights]);

    return (
        <OverviewView
            agent={agent}
            heading={
                selectedHighlight?.headline ??
                buildOverviewHeading({
                    jobs,
                    memoryCount,
                    phraseSeed,
                    sessionsCount: sessions.length,
                    workers,
                })
            }
            jobCount={jobs.length}
            memoryCount={memoryCount}
            receipt={selectedHighlight?.receipt ?? null}
            receiptTo={buildHighlightLink(selectedHighlight)}
            sessionsCount={sessions.length}
            workerCount={workers.length}
        />
    );
}

function buildHighlightLink(highlight: HighlightListOutput['highlights'][number] | null) {
    if (highlight?.category !== 'wiki_attention') {
        return null;
    }
    return '/dashboard/cortex?view=health';
}

function pickLandingHighlight(highlights: HighlightListOutput['highlights']) {
    if (highlights.length === 0) {
        return null;
    }

    return highlights[Math.floor(Math.random() * highlights.length)] ?? null;
}
