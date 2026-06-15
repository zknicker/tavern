import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { CodeSnippet } from '../../../components/ui/code-snippet.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow, SettingsValue } from '../../../components/ui/settings-row.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { useCortexStatus } from '../../../hooks/cortex/use-cortex-status.ts';
import type { CortexStatusOutput } from '../../../lib/trpc.tsx';

type WikiHubStatus = NonNullable<CortexStatusOutput>;

export function MemoriesSettings() {
    const statusQuery = useCortexStatus();

    return (
        <div>
            <BadgeDivider className="pb-4" subtext="Read-only Cortex wiki hub status.">
                Wiki
            </BadgeDivider>
            <WikiHubStatusCard
                error={statusQuery.error?.message ?? null}
                isLoading={statusQuery.isPending}
                status={statusQuery.data ?? null}
            />
        </div>
    );
}

export function WikiHubStatusCard({
    error,
    isLoading,
    status,
}: {
    error?: string | null;
    isLoading?: boolean;
    status: WikiHubStatus | null;
}) {
    if (isLoading) {
        return (
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <Skeleton className="h-16 rounded-none" />
                    <Separator />
                    <Skeleton className="h-16 rounded-none" />
                    <Separator />
                    <Skeleton className="h-16 rounded-none" />
                </Card>
            </CardFrame>
        );
    }

    if (!status) {
        return (
            <CardFrame>
                <Card className="p-4 text-muted-foreground text-sm">
                    {error ?? 'Tavern Runtime unavailable.'}
                </Card>
            </CardFrame>
        );
    }

    return (
        <CardFrame>
            <Card className="overflow-hidden p-0">
                <SettingsRow title="Hub path">
                    <CodeSnippet lines={status.hubPath} />
                </SettingsRow>
                <Separator />
                <SettingsRow title="Config source">
                    <SettingsValue>{formatConfigSource(status.configSource)}</SettingsValue>
                </SettingsRow>
                <Separator />
                <SettingsRow title="Active topics">
                    <SettingsValue>{status.topicCount}</SettingsValue>
                </SettingsRow>
                <Separator />
                <SettingsRow title="Archived topics">
                    <SettingsValue>{status.archivedTopicCount}</SettingsValue>
                </SettingsRow>
                <Separator />
                <SettingsRow title="Markdown pages">
                    <SettingsValue>{status.pageCount}</SettingsValue>
                </SettingsRow>
                <Separator />
                <SettingsRow title="Access">
                    <SettingsValue>{formatAccess(status)}</SettingsValue>
                </SettingsRow>
                <Separator />
                <SettingsRow title="Wiki work">
                    <SettingsValue>Tasks and Runtime crons</SettingsValue>
                </SettingsRow>
                {error ? (
                    <>
                        <Separator />
                        <div className="px-5 py-3.5 text-destructive text-sm">{error}</div>
                    </>
                ) : null}
            </Card>
        </CardFrame>
    );
}

function formatAccess(status: Pick<WikiHubStatus, 'readable' | 'writable'>) {
    if (status.readable && status.writable) {
        return 'Readable and writable';
    }

    if (status.readable) {
        return 'Read-only';
    }

    return 'Unavailable';
}

function formatConfigSource(source: WikiHubStatus['configSource']) {
    switch (source) {
        case 'environment':
            return 'Environment';
        case 'runtime':
            return 'Runtime managed';
    }
}
