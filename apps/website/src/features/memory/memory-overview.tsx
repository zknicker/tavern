import { ArrowRight01Icon } from '@hugeicons-pro/core-solid-rounded';
import { Folder01Icon, HourglassIcon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../components/ui/badge.tsx';
import { Card, CardFrame } from '../../components/ui/card.tsx';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { SettingsRow, SettingsValue } from '../../components/ui/settings-row.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { appRoutes } from '../../lib/app-routes.ts';
import {
    formatWikiAccess,
    formatWikiConfigSource,
    getWikiHealth,
    type WikiHubStatus,
} from './memory-status-format.ts';

export function MemoryOverview({ status }: { status: WikiHubStatus | null }) {
    const health = getWikiHealth(status);
    const unavailable = 'Grotto Runtime unavailable';

    return (
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 pt-12 pb-24 text-left">
                <header className="space-y-2">
                    <h1 className="font-semibold text-2xl tracking-tight">Memory</h1>
                    <p className="max-w-2xl text-muted-foreground text-sm leading-6">
                        Durable knowledge lives in Memory. The agent reads and maintains those
                        Markdown files through regular Automations.
                    </p>
                </header>

                <MemorySection title="Settings">
                    <SettingsRow
                        description="Agents can use Memory as durable knowledge."
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
                            render={<NavLink to={appRoutes.automations} />}
                            size="sm"
                            variant="outline"
                        >
                            <Icon icon={HourglassIcon} />
                            <span>Open Automations</span>
                        </Button>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow
                        description="Browse Markdown pages, links, backlinks, and search results."
                        title="Wiki pages"
                        trailingWidth="intrinsic"
                    >
                        <Button
                            render={<NavLink to={appRoutes.wiki} />}
                            size="sm"
                            variant="outline"
                        >
                            <Icon icon={Folder01Icon} />
                            <span>Open Wiki</span>
                        </Button>
                    </SettingsRow>
                </MemorySection>

                <MemorySection title="Memory">
                    <SettingsRow
                        description="Runtime can resolve and inspect the Wiki folder."
                        title="Wiki health"
                        trailingWidth="intrinsic"
                    >
                        <Badge variant={health.variant}>{health.label}</Badge>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Config source">
                        <SettingsValue>
                            {status ? formatWikiConfigSource(status.configSource) : unavailable}
                        </SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Markdown pages">
                        <SettingsValue>{status?.pageCount ?? unavailable}</SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="TAXONOMY.md">
                        <SettingsValue>{status?.indexExists ? 'Present' : 'Missing'}</SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Access">
                        <SettingsValue>{formatWikiAccess(status)}</SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Wiki path" trailingWidth="wide">
                        <CodeSnippet lines={status?.wikiPath ?? unavailable} />
                    </SettingsRow>
                </MemorySection>

                <MemorySection title="History">
                    <SettingsRow
                        description="Maintenance runs and source sessions are tracked as Automations until Grotto has a dedicated memory history log."
                        title="Recent runs"
                        trailingWidth="intrinsic"
                    >
                        <Button
                            render={<NavLink to={appRoutes.automations} />}
                            size="sm"
                            variant="ghost"
                        >
                            <span>View Automations</span>
                            <Icon icon={ArrowRight01Icon} />
                        </Button>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow
                        description="File-level changes remain inspectable in Wiki."
                        title="Changed files"
                        trailingWidth="intrinsic"
                    >
                        <Button render={<NavLink to={appRoutes.wiki} />} size="sm" variant="ghost">
                            <span>Browse files</span>
                            <Icon icon={ArrowRight01Icon} />
                        </Button>
                    </SettingsRow>
                </MemorySection>
            </section>
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
