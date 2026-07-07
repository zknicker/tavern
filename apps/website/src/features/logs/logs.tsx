import * as React from 'react';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import {
    toRuntimePageConnectionState,
    useRuntimeConnection,
} from '../../hooks/connections/use-runtime-connection.ts';
import { useLogsSuspense } from '../../hooks/use-logs.ts';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import { WorkerLogs } from './worker-logs.tsx';
import { buildWorkerRecords } from './worker-records.ts';

export function Logs() {
    const { navigateToSettings } = useLayoutContext();
    const runtimeConnection = useRuntimeConnection();
    const [logs] = useLogsSuspense();
    const relativeNow = useRelativeNow();
    const workers = React.useMemo(
        () => buildWorkerRecords(logs.logs, relativeNow),
        [logs.logs, relativeNow]
    );

    return (
        <WorkerLogs
            connectionState={toRuntimePageConnectionState(runtimeConnection.status)}
            onNavigateToSettings={navigateToSettings}
            workers={workers}
        />
    );
}
