import * as React from 'react';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import { useAgentListSuspense } from '../../hooks/agents/use-agent-list.ts';
import {
    toRuntimePageConnectionState,
    useRuntimeConnection,
} from '../../hooks/connections/use-runtime-connection.ts';
import { useSessionListSuspense } from '../../hooks/sessions/use-session-list.ts';
import { GridPageSkeleton } from '../shell/page-skeletons.tsx';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import { buildSessionList } from './session-list-data.ts';
import { SessionsList } from './sessions-list.tsx';

export function Sessions() {
    return (
        <React.Suspense fallback={<GridPageSkeleton />}>
            <SessionsContent />
        </React.Suspense>
    );
}

function SessionsContent() {
    const { navigateToSettings } = useLayoutContext();
    const [agents] = useAgentListSuspense();
    const runtimeConnection = useRuntimeConnection();
    const [sessionsData] = useSessionListSuspense();
    const relativeNow = useRelativeNow();
    const sessions = React.useMemo(
        () => buildSessionList(agents.agents, sessionsData.sessions, relativeNow),
        [agents.agents, sessionsData.sessions, relativeNow]
    );

    return (
        <SessionsList
            connectionState={toRuntimePageConnectionState(runtimeConnection.status)}
            onNavigateToSettings={navigateToSettings}
            sessions={sessions}
        />
    );
}
