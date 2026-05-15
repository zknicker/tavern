import * as React from 'react';
import {
    toAgentRuntimePageConnectionState,
    useAgentRuntimeConnection,
} from '../../hooks/connections/use-agent-runtime-connection.ts';
import { useLogsSuspense } from '../../hooks/use-logs.ts';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import { WorkerLogs } from './worker-logs.tsx';
import { buildWorkerRecords } from './worker-records.ts';

export function Logs() {
    const { navigateToSettings } = useLayoutContext();
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const [logs] = useLogsSuspense();
    const workers = React.useMemo(() => buildWorkerRecords(logs.logs), [logs.logs]);

    return (
        <WorkerLogs
            connectionState={toAgentRuntimePageConnectionState(agentRuntimeConnection.status)}
            onNavigateToSettings={navigateToSettings}
            workers={workers}
        />
    );
}
