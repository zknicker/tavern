import type { MemoryJobDetail, MemoryJobSummary } from '@tavern/api';
import { BrainIcon } from 'lucide-react';
import * as React from 'react';
import { CodeSnippet } from '../../../components/ui/code-snippet.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../../components/ui/settings-row.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import {
    useSaveSemanticMemorySettings,
    useSemanticMemorySettings,
    useSemanticMemoryStatus,
} from '../../../hooks/semantic-memory/use-semantic-memory-status.ts';
import { queryPolicy } from '../../../lib/query-policy.ts';
import { trpc } from '../../../lib/trpc.tsx';
import {
    formatSemanticMemoryAccess,
    formatSemanticMemoryConfigSource,
    type SemanticMemoryHubStatus,
    type SemanticMemorySettings,
} from '../../memory/memory-status-format.ts';

type MemoryJobDetailView = Omit<MemoryJobDetail, 'transcript' | 'usage'> & {
    transcript?: unknown;
    usage?: unknown;
};

export function MemoriesSettings() {
    const utils = trpc.useUtils();
    const statusQuery = useSemanticMemoryStatus();
    const settingsQuery = useSemanticMemorySettings();
    const saveSettings = useSaveSemanticMemorySettings();
    const memorySettingsQuery = trpc.memory.settings.useQuery(
        undefined,
        queryPolicy.agentRuntimeSnapshot
    );
    const saveMemorySettings = trpc.memory.saveSettings.useMutation({
        onSuccess: async () => {
            await utils.memory.settings.invalidate();
        },
    });
    const agentsQuery = useAgentList();
    const agentId = agentsQuery.data?.agents[0]?.id ?? null;

    return (
        <SettingsPage>
            <SettingsPageHeader title="Memory" />
            <SettingsSection title="Settings">
                <SettingsGroup>
                    <SettingsRow
                        description="Background extraction and dreaming for all agents."
                        title="Memory"
                        trailingWidth="intrinsic"
                    >
                        <Switch
                            aria-label="Memory enabled"
                            checked={memorySettingsQuery.data?.enabled ?? true}
                            disabled={memorySettingsQuery.isPending || saveMemorySettings.isPending}
                            onCheckedChange={(enabled) => saveMemorySettings.mutate({ enabled })}
                        />
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
            <SettingsSection title="Memory">
                <SemanticMemorySettingsCard
                    error={
                        settingsQuery.error?.message ??
                        statusQuery.error?.message ??
                        saveSettings.error?.message ??
                        null
                    }
                    isLoading={settingsQuery.isPending || statusQuery.isPending}
                    isSaving={saveSettings.isPending}
                    onSave={(memoryPath) => saveSettings.mutateAsync({ memoryPath })}
                    settings={settingsQuery.data ?? null}
                    status={statusQuery.data ?? null}
                />
            </SettingsSection>
            <MemoryHistorySection agentId={agentId} />
        </SettingsPage>
    );
}

export function SemanticMemorySettingsCard({
    error,
    isLoading,
    isSaving,
    onSave,
    settings,
    status,
}: {
    error?: string | null;
    isLoading?: boolean;
    isSaving?: boolean;
    onSave: (memoryPath: string) => Promise<unknown> | undefined;
    settings: SemanticMemorySettings | null;
    status: SemanticMemoryHubStatus | null;
}) {
    const [memoryPath, setSemanticMemoryPath] = React.useState('');

    React.useEffect(() => {
        if (settings) {
            setSemanticMemoryPath(settings.configuredPath ?? settings.effectivePath);
        }
    }, [settings]);

    if (isLoading) {
        return (
            <SettingsGroup>
                <Skeleton className="h-16 rounded-none" />
                <Separator />
                <Skeleton className="h-16 rounded-none" />
                <Separator />
                <Skeleton className="h-16 rounded-none" />
            </SettingsGroup>
        );
    }

    if (!(settings && status)) {
        return (
            <SettingsGroup contentClassName="p-4 text-muted-foreground text-sm">
                {error ?? 'Tavern Runtime unavailable.'}
            </SettingsGroup>
        );
    }

    const trimmedPath = memoryPath.trim();
    const environmentLocked = settings.configSource === 'environment';
    const hasChanged =
        trimmedPath && trimmedPath !== (settings.configuredPath ?? settings.effectivePath);

    return (
        <SettingsGroup>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!(trimmedPath && hasChanged && !environmentLocked)) {
                        return;
                    }
                    void onSave(trimmedPath);
                }}
            >
                <SettingsRow
                    description="Defaults to the managed Runtime memory directory."
                    error={environmentLocked ? 'TAVERN_MEMORY_PATH is set by environment.' : null}
                    title="Memory path"
                    trailingWidth="wide"
                >
                    <div className="flex max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <Input
                            aria-label="Memory path"
                            className="font-mono md:flex-1"
                            disabled={isSaving || environmentLocked}
                            name="semantic-memory-path"
                            onChange={(event) => setSemanticMemoryPath(event.currentTarget.value)}
                            value={memoryPath}
                        />
                        <Button
                            className="w-fit"
                            disabled={!(trimmedPath && hasChanged) || isSaving || environmentLocked}
                            loading={isSaving}
                            type="submit"
                            variant="secondary"
                        >
                            Save
                        </Button>
                    </div>
                </SettingsRow>
            </form>
            <Separator />
            <SettingsRow title="Effective path" trailingWidth="wide">
                <CodeSnippet lines={settings.effectivePath} />
            </SettingsRow>
            <Separator />
            <SettingsRow title="Config source">
                <SettingsValue>
                    {formatSemanticMemoryConfigSource(settings.configSource)}
                </SettingsValue>
            </SettingsRow>
            <Separator />
            <SettingsRow title="Markdown pages">
                <SettingsValue>{status.pageCount}</SettingsValue>
            </SettingsRow>
            <Separator />
            <SettingsRow title="TAXONOMY.md">
                <SettingsValue>{status.indexExists ? 'Present' : 'Missing'}</SettingsValue>
            </SettingsRow>
            <Separator />
            <SettingsRow title="Access">
                <SettingsValue>{formatSemanticMemoryAccess(status)}</SettingsValue>
            </SettingsRow>
            {error ? (
                <>
                    <Separator />
                    <div className="px-5 py-3.5 text-destructive text-sm">{error}</div>
                </>
            ) : null}
        </SettingsGroup>
    );
}

function MemoryHistorySection({ agentId }: { agentId: string | null }) {
    const utils = trpc.useUtils();
    const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
    const jobsQuery = trpc.memory.jobs.useQuery(agentId ? { agentId, limit: 50 } : { limit: 50 }, {
        ...queryPolicy.agentRuntimeSnapshot,
        enabled: Boolean(agentId),
        refetchInterval: (query) =>
            query.state.data?.jobs.some(
                (job) => job.status === 'queued' || job.status === 'running'
            )
                ? 2500
                : false,
    });
    const jobs = jobsQuery.data?.jobs ?? [];

    React.useEffect(() => {
        if (jobs.length === 0) {
            setSelectedJobId(null);
            return;
        }
        if (!(selectedJobId && jobs.some((job) => job.id === selectedJobId))) {
            setSelectedJobId(jobs[0]?.id ?? null);
        }
    }, [jobs, selectedJobId]);

    const selectedJobQuery = trpc.memory.getJob.useQuery(
        { id: selectedJobId ?? '' },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            enabled: Boolean(selectedJobId),
            refetchInterval: (query) => {
                const status = query.state.data?.status;
                return status === 'queued' || status === 'running' ? 2500 : false;
            },
        }
    );
    const runDream = trpc.memory.runDream.useMutation({
        onSuccess: async (result) => {
            setSelectedJobId(result.job.id);
            await Promise.all([
                utils.memory.jobs.invalidate(),
                utils.memory.getJob.invalidate({ id: result.job.id }),
            ]);
        },
    });

    return (
        <SettingsSection
            action={
                <Button
                    disabled={!agentId}
                    loading={runDream.isPending}
                    onClick={() => agentId && runDream.mutate({ agentId })}
                    size="sm"
                    variant="secondary"
                >
                    <BrainIcon />
                    Dream now
                </Button>
            }
            title="History"
        >
            <SettingsGroup>
                <div className="grid min-h-96 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
                    <div className="border-border/70 border-b md:border-e md:border-b-0">
                        {renderMemoryJobList({
                            isLoading: jobsQuery.isPending,
                            jobs,
                            onSelect: setSelectedJobId,
                            selectedJobId,
                        })}
                    </div>
                    <MemoryJobDetailPane
                        error={
                            jobsQuery.error?.message ??
                            selectedJobQuery.error?.message ??
                            runDream.error?.message ??
                            null
                        }
                        isLoading={selectedJobQuery.isPending && Boolean(selectedJobId)}
                        job={selectedJobQuery.data ?? null}
                    />
                </div>
            </SettingsGroup>
        </SettingsSection>
    );
}

function renderMemoryJobList({
    isLoading,
    jobs,
    onSelect,
    selectedJobId,
}: {
    isLoading: boolean;
    jobs: MemoryJobSummary[];
    onSelect: (id: string) => void;
    selectedJobId: string | null;
}) {
    if (isLoading) {
        return <Skeleton className="m-3 h-16 rounded-md" />;
    }

    if (jobs.length === 0) {
        return <p className="px-5 py-4 text-muted-foreground text-sm">No Memory jobs yet.</p>;
    }

    return (
        <div className="max-h-[34rem] overflow-y-auto p-2">
            {jobs.map((job) => (
                <button
                    className={`block w-full rounded-md px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent/45 focus-visible:bg-accent/45 ${
                        selectedJobId === job.id ? 'bg-accent text-accent-foreground' : ''
                    }`}
                    key={job.id}
                    onClick={() => onSelect(job.id)}
                    type="button"
                >
                    <span className="block truncate font-medium text-sm">
                        {formatMemoryJobTitle(job)}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                        {formatMemoryJobSubtitle(job)}
                    </span>
                    {job.fileChangeCount > 0 ? (
                        <span className="block truncate text-xs">
                            {job.fileChangeCount} file{' '}
                            {job.fileChangeCount === 1 ? 'changed' : 'changes'}
                        </span>
                    ) : null}
                </button>
            ))}
        </div>
    );
}

function MemoryJobDetailPane({
    error,
    isLoading,
    job,
}: {
    error: string | null;
    isLoading: boolean;
    job: MemoryJobDetailView | null;
}) {
    if (isLoading) {
        return <Skeleton className="m-4 h-24 rounded-md" />;
    }

    if (error) {
        return <div className="px-5 py-4 text-destructive text-sm">{error}</div>;
    }

    if (!job) {
        return <p className="px-5 py-4 text-muted-foreground text-sm">Select a Memory job.</p>;
    }

    return (
        <div className="space-y-4 p-4">
            <div>
                <h3 className="font-medium text-foreground text-sm">{formatMemoryJobTitle(job)}</h3>
                <p className="text-muted-foreground text-xs">{formatMemoryJobSubtitle(job)}</p>
            </div>

            {job.error ? <div className="text-destructive text-sm">{job.error}</div> : null}

            <div className="rounded-lg border border-border/70 px-3 py-2 text-muted-foreground text-sm">
                {job.fileChanges.length === 0 ? (
                    'No file changes recorded.'
                ) : (
                    <ul className="space-y-1">
                        {job.fileChanges.map((change) => (
                            <li className="truncate" key={`${change.path}-${change.afterHash}`}>
                                {change.path}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <MemoryJobJsonBlock label="Metadata" value={job.metadata} />
            <MemoryJobJsonBlock label="Transcript" value={job.transcript} />
        </div>
    );
}

function MemoryJobJsonBlock({ label, value }: { label: string; value: unknown }) {
    const text = JSON.stringify(value, null, 2);
    if (!text || text === '{}' || text === '[]' || text === 'null') {
        return null;
    }
    return (
        <details className="rounded-lg border border-border/70 px-3 py-2">
            <summary className="cursor-pointer font-medium text-muted-foreground text-sm">
                {label}
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                {text}
            </pre>
        </details>
    );
}

function formatMemoryJobTitle(job: MemoryJobSummary) {
    if (job.kind === 'dream') {
        return job.fileChangeCount > 0 ? 'Dreamed semantic memory' : 'Dreamed Memory';
    }
    return 'Extracted episodic Memory';
}

function formatMemoryJobSubtitle(job: MemoryJobSummary) {
    const pieces = [
        job.status,
        formatShortTime(job.completedAt ?? job.updatedAt ?? job.createdAt),
        job.modelCategory ? `${job.modelCategory} model` : null,
    ].filter(Boolean);
    return pieces.join(' · ');
}

function formatShortTime(value: string) {
    return new Date(value).toLocaleString(undefined, {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
    });
}
