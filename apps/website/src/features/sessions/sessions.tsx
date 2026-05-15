import * as React from 'react';
import { useAgentAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { useAgentListSuspense } from '../../hooks/agents/use-agent-list.ts';
import {
    toAgentRuntimePageConnectionState,
    useAgentRuntimeConnection,
} from '../../hooks/connections/use-agent-runtime-connection.ts';
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
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const [sessionsData] = useSessionListSuspense();
    const sessions = React.useMemo(
        () => buildSessionList(agents.agents, sessionsData.sessions),
        [agents.agents, sessionsData.sessions]
    );
    const avatarDirectory = useAgentAvatarDirectory(agents.agents);

    return (
        <SessionsList
            avatarDirectory={avatarDirectory}
            connectionState={toAgentRuntimePageConnectionState(agentRuntimeConnection.status)}
            onNavigateToSettings={navigateToSettings}
            sessions={sessions}
        />
    );
}
