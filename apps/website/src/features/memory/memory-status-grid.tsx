import { Card, CardFrame } from '../../components/ui/card.tsx';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { SettingsRow, SettingsValue } from '../../components/ui/settings-row.tsx';
import type { MemoryStatusOutput } from '../../lib/trpc.tsx';

type LoadedMemoryStatus = NonNullable<MemoryStatusOutput>;

interface MemoryStatusGridProps {
    connectionStatus: 'reachable' | 'unconfigured' | 'unreachable';
    isLoading?: boolean;
    status: MemoryStatusOutput | null;
}

function formatTimestamp(value: string | null) {
    if (!value) {
        return 'Not yet available';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function getEmbedderCopy(
    status: LoadedMemoryStatus,
    connectionStatus: MemoryStatusGridProps['connectionStatus']
) {
    if (connectionStatus !== 'reachable') {
        return 'Tavern Runtime unavailable';
    }

    switch (status.embedderStatus) {
        case 'ready':
            return 'Ready';
        case 'disabled':
            return 'Disabled';
        default:
            return 'Not ready yet';
    }
}

function getValueCopy(
    value: string | null,
    connectionStatus: MemoryStatusGridProps['connectionStatus'],
    isLoading: boolean | undefined
) {
    if (isLoading) {
        return 'Loading...';
    }

    if (connectionStatus !== 'reachable') {
        return 'Tavern Runtime unavailable';
    }

    return formatTimestamp(value);
}

const memoryStatusRows = [
    {
        key: 'lanceDbPath',
        title: 'LanceDB path',
    },
    {
        key: 'embedderHealth',
        title: 'Embedder health',
    },
    {
        key: 'lastBulletinBuild',
        title: 'Last bulletin build',
    },
    {
        key: 'lastWorkingSynthesis',
        title: 'Last working synthesis',
    },
    {
        key: 'lastCapture',
        title: 'Last capture',
    },
    {
        key: 'lastDreamRun',
        title: 'Last dream run',
    },
] as const;

export function MemoryStatusGrid({ connectionStatus, isLoading, status }: MemoryStatusGridProps) {
    const rowValues = {
        embedderHealth:
            isLoading || !status
                ? isLoading
                    ? 'Loading...'
                    : 'Tavern Runtime unavailable'
                : getEmbedderCopy(status, connectionStatus),
        lanceDbPath:
            isLoading || !status
                ? isLoading
                    ? 'Loading...'
                    : 'Tavern Runtime unavailable'
                : connectionStatus === 'reachable'
                  ? (status?.lanceDbPath ?? 'Tavern Runtime unavailable')
                  : 'Tavern Runtime unavailable',
        lastBulletinBuild: getValueCopy(
            status?.lastBulletinBuildAt ?? null,
            connectionStatus,
            isLoading
        ),
        lastCapture: getValueCopy(status?.lastCaptureAt ?? null, connectionStatus, isLoading),
        lastDreamRun: getValueCopy(status?.lastDreamRunAt ?? null, connectionStatus, isLoading),
        lastWorkingSynthesis: getValueCopy(
            status?.lastWorkingSynthesisAt ?? null,
            connectionStatus,
            isLoading
        ),
    } as const;

    return (
        <CardFrame>
            <Card className="overflow-hidden p-0">
                {memoryStatusRows.map((row, index) => (
                    <div key={row.key}>
                        {index === 0 ? null : <Separator />}
                        <SettingsRow title={row.title}>
                            {row.key === 'lanceDbPath' ? (
                                <CodeSnippet lines={rowValues[row.key]} />
                            ) : (
                                <SettingsValue>{rowValues[row.key]}</SettingsValue>
                            )}
                        </SettingsRow>
                    </div>
                ))}
            </Card>
        </CardFrame>
    );
}
