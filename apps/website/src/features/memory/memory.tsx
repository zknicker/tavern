import { ArrowRight01Icon } from '@hugeicons-pro/core-solid-rounded';
import { Folder01Icon, HourglassIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../components/ui/badge.tsx';
import { Card, CardFrame } from '../../components/ui/card.tsx';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { SettingsRow, SettingsValue } from '../../components/ui/settings-row.tsx';
import { Skeleton } from '../../components/ui/skeleton.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { useVaultStatusSuspense } from '../../hooks/vault/use-vault-status.ts';
import {
    formatVaultAccess,
    formatVaultConfigSource,
    getVaultHealth,
    type VaultHubStatus,
} from './wiki-status-format.ts';

function MemoryContent() {
    const [status] = useVaultStatusSuspense();

    return <MemoryOverview status={status ?? null} />;
}

export function Memory() {
    return (
        <React.Suspense fallback={<MemoryLoadingState />}>
            <MemoryContent />
        </React.Suspense>
    );
}

export function MemoryOverview({ status }: { status: VaultHubStatus | null }) {
    const health = getVaultHealth(status);
    const unavailable = 'Tavern Runtime unavailable';

    return (
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 pt-12 pb-24 text-left">
                <header className="space-y-2">
                    <h1 className="font-semibold text-2xl tracking-tight">Memory</h1>
                    <p className="max-w-2xl text-muted-foreground text-sm leading-6">
                        Durable knowledge lives in Vault. The agent reads and maintains those
                        Markdown files through regular Tasks.
                    </p>
                </header>

                <MemorySection title="Settings">
                    <SettingsRow
                        description="Agents can use Vault as durable knowledge."
                        title="Enable memories"
                        trailingWidth="intrinsic"
                    >
                        <div className="flex min-h-8 items-center justify-end gap-2">
                            <Badge variant={health.variant}>{health.label}</Badge>
                            <Switch
                                aria-label="Memory enabled"
                                checked={Boolean(status?.readable)}
                                disabled
                            />
                        </div>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow
                        description="Observations are retained as Markdown until maintenance work changes them."
                        title="Episodic retention"
                    >
                        <SettingsValue>Plain Markdown</SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow
                        description="Research, ingest, compile, audit, and cleanup run as regular agent work."
                        title="Memory maintenance"
                        trailingWidth="intrinsic"
                    >
                        <Button
                            render={<NavLink to="/dashboard/cron" />}
                            size="sm"
                            variant="outline"
                        >
                            <Icon icon={HourglassIcon} />
                            <span>Open Tasks</span>
                        </Button>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow
                        description="Browse Markdown pages, links, backlinks, and search results."
                        title="Memory files"
                        trailingWidth="intrinsic"
                    >
                        <Button
                            render={<NavLink to="/dashboard/vault" />}
                            size="sm"
                            variant="outline"
                        >
                            <Icon icon={Folder01Icon} />
                            <span>Open Vault</span>
                        </Button>
                    </SettingsRow>
                </MemorySection>

                <MemorySection title="Vault">
                    <SettingsRow
                        description="Runtime can resolve and inspect the Vault folder."
                        title="Vault health"
                        trailingWidth="intrinsic"
                    >
                        <Badge variant={health.variant}>{health.label}</Badge>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Config source">
                        <SettingsValue>
                            {status ? formatVaultConfigSource(status.configSource) : unavailable}
                        </SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Markdown pages">
                        <SettingsValue>{status?.pageCount ?? unavailable}</SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="INDEX.md">
                        <SettingsValue>{status?.indexExists ? 'Present' : 'Missing'}</SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Access">
                        <SettingsValue>{formatVaultAccess(status)}</SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Vault path">
                        <CodeSnippet lines={status?.vaultPath ?? unavailable} />
                    </SettingsRow>
                </MemorySection>

                <MemorySection title="History">
                    <SettingsRow
                        description="Maintenance runs and source sessions are tracked as Tasks until Tavern has a dedicated memory history log."
                        title="Recent runs"
                        trailingWidth="intrinsic"
                    >
                        <Button render={<NavLink to="/dashboard/cron" />} size="sm" variant="ghost">
                            <span>View Tasks</span>
                            <Icon icon={ArrowRight01Icon} />
                        </Button>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow
                        description="File-level changes remain inspectable in Vault."
                        title="Changed files"
                        trailingWidth="intrinsic"
                    >
                        <Button
                            render={<NavLink to="/dashboard/vault" />}
                            size="sm"
                            variant="ghost"
                        >
                            <span>Browse files</span>
                            <Icon icon={ArrowRight01Icon} />
                        </Button>
                    </SettingsRow>
                </MemorySection>
            </main>
        </div>
    );
}

function MemorySection({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <section className="space-y-3">
            <h2 className="font-medium text-foreground text-sm">{title}</h2>
            <CardFrame>
                <Card className="overflow-hidden p-0">{children}</Card>
            </CardFrame>
        </section>
    );
}

function MemoryLoadingState() {
    return (
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 pt-12 pb-24">
                <header className="space-y-3">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full max-w-xl" />
                    <Skeleton className="h-4 w-96 max-w-full" />
                </header>

                <MemorySkeletonSection />
                <MemorySkeletonSection />
            </main>
        </div>
    );
}

function MemorySkeletonSection() {
    return (
        <section className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <Skeleton className="h-17 rounded-none" />
                    <Separator />
                    <Skeleton className="h-17 rounded-none" />
                    <Separator />
                    <Skeleton className="h-17 rounded-none" />
                </Card>
            </CardFrame>
        </section>
    );
}
