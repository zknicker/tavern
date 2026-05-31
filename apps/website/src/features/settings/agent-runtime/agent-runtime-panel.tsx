import { Refresh04Icon } from '@hugeicons-pro/core-solid-rounded';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Field, FieldError } from '../../../components/ui/primitives/field.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SettingsItem } from '../../../components/ui/settings-row.tsx';
import { useConnectAgentRuntime } from '../../../hooks/connections/use-connect-agent-runtime.ts';
import { type AgentRuntimeConnectionOutput, trpc } from '../../../lib/trpc.tsx';
import { OpenClawCapabilitiesSummary } from './openclaw-capabilities-table.tsx';

interface AgentRuntimeSettingsPanelProps {
    runtime: AgentRuntimeConnectionOutput;
}

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;

function getHealthBadge(
    connection: RuntimeConnection
): { label: string; variant: 'error' | 'warning' } | null {
    if (!connection.enabled) {
        return null;
    }
    if (connection.lastError) {
        return { label: 'Unreachable', variant: 'error' };
    }
    if (connection.runtimeVersion && connection.versionStatus === 'mismatched') {
        return { label: 'Version mismatch', variant: 'error' };
    }
    if (connection.runtimeCapabilities.some((capability) => capability.state !== 'healthy')) {
        return { label: 'Degraded', variant: 'warning' };
    }
    return null;
}

function CapabilitySection({
    capabilities,
    emptyLabel,
    onCapabilityClick,
    onCapabilityRefresh,
    refreshingCapability,
}: {
    capabilities: RuntimeConnection['capabilities'];
    emptyLabel: string;
    onCapabilityClick?: (capability: RuntimeConnection['capabilities'][number]) => void;
    onCapabilityRefresh?: (capability: RuntimeConnection['capabilities'][number]) => void;
    refreshingCapability?: RuntimeConnection['capabilities'][number]['capability'] | null;
}) {
    return (
        <div>
            <OpenClawCapabilitiesSummary
                capabilities={capabilities}
                emptyLabel={emptyLabel}
                onCapabilityClick={onCapabilityClick}
                onCapabilityRefresh={onCapabilityRefresh}
                refreshingCapability={refreshingCapability}
            />
        </div>
    );
}

function RuntimeConnectionRow({ connection }: { connection: RuntimeConnection }) {
    const queryClient = useQueryClient();
    const healthMutation = trpc.agentRuntime.checkHealth.useMutation({
        onSettled: async () => {
            await queryClient.invalidateQueries();
        },
    });
    const capabilityMutation = trpc.agentRuntime.refreshCapability.useMutation({
        onSettled: async () => {
            await queryClient.invalidateQueries();
        },
    });
    const healthBadge = getHealthBadge(connection);

    return (
        <SettingsItem className="flex flex-col gap-4 px-3.5 pt-3.5 pb-2">
            <div className="grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(18rem,32rem)] md:items-start md:gap-6">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground text-sm">Tavern Runtime</h3>
                        {healthBadge ? (
                            <Badge size="sm" variant={healthBadge.variant}>
                                {healthBadge.label}
                            </Badge>
                        ) : null}
                    </div>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                    <Button
                        loading={healthMutation.isPending}
                        onClick={() => healthMutation.mutate()}
                        size="sm"
                        type="button"
                        variant="secondary"
                    >
                        <Icon icon={Refresh04Icon} />
                        Check
                    </Button>
                </div>
            </div>
            {connection.lastError ? (
                <p className="text-destructive text-sm">{connection.lastError}</p>
            ) : null}
            <p className="max-w-3xl text-muted-foreground text-sm leading-6">
                Tavern manages the local OpenClaw runtime for agent work, including generated
                configuration, Seatbelt guardrails, and capability health.
            </p>
            <RuntimeUrlForm connection={connection} />
            <CapabilitySection
                capabilities={connection.runtimeCapabilities}
                emptyLabel="No Tavern Runtime capability checks recorded."
                onCapabilityRefresh={(capability) =>
                    capabilityMutation.mutate(capability.capability)
                }
                refreshingCapability={
                    capabilityMutation.isPending ? capabilityMutation.variables : null
                }
            />
        </SettingsItem>
    );
}

function RuntimeMetadata({ connection }: { connection: RuntimeConnection }) {
    return (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
            <div className="min-w-0">
                <dt className="text-muted-foreground">App</dt>
                <dd className="truncate font-mono text-foreground">{connection.appVersion}</dd>
            </div>
            <div className="min-w-0">
                <dt className="text-muted-foreground">Runtime</dt>
                <dd className="truncate font-mono text-foreground">
                    {connection.runtimeVersion ?? 'Unknown'}
                </dd>
            </div>
        </dl>
    );
}

function RuntimeUrlForm({ connection }: { connection: RuntimeConnection }) {
    const inputId = React.useId();
    const [baseUrl, setBaseUrl] = React.useState(connection.baseUrl);
    const connectMutation = useConnectAgentRuntime();
    const trimmedBaseUrl = baseUrl.trim();
    const hasChanged = trimmedBaseUrl !== connection.baseUrl;

    React.useEffect(() => {
        setBaseUrl(connection.baseUrl);
    }, [connection.baseUrl]);

    return (
        <form
            className="grid gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                if (!(trimmedBaseUrl && hasChanged)) {
                    return;
                }
                connectMutation.mutate({ baseUrl: trimmedBaseUrl });
            }}
        >
            <Field>
                <div className="flex max-w-full flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        aria-label="Tavern Runtime URL"
                        className="font-mono sm:w-[32rem]"
                        disabled={connectMutation.isPending || connection.source === 'environment'}
                        id={inputId}
                        name="runtime-url"
                        onChange={(event) => setBaseUrl(event.currentTarget.value)}
                        value={baseUrl}
                    />
                    <Button
                        className="w-fit"
                        disabled={
                            !(trimmedBaseUrl && hasChanged) ||
                            connectMutation.isPending ||
                            connection.source === 'environment'
                        }
                        loading={connectMutation.isPending}
                        type="submit"
                        variant="secondary"
                    >
                        Save URL
                    </Button>
                </div>
            </Field>
            {connectMutation.error ? (
                <FieldError>{connectMutation.error.message}</FieldError>
            ) : null}
        </form>
    );
}

function MissingRuntimeRow() {
    return (
        <SettingsItem className="grid gap-2 px-3.5 py-3.5">
            <h3 className="font-medium text-foreground text-sm">Tavern Runtime</h3>
            <p className="text-muted-foreground text-sm">
                No managed runtime has reported status yet. Start Tavern through the desktop app or
                the local dev stack so the server can discover the managed OpenClaw runtime.
            </p>
        </SettingsItem>
    );
}

export function AgentRuntimeSettingsPanel({ runtime }: AgentRuntimeSettingsPanelProps) {
    return (
        <div className="grid gap-8">
            <section>
                <BadgeDivider className="pb-4">Tavern Runtime</BadgeDivider>
                <CardFrame>
                    <Card className="overflow-hidden p-0">
                        {runtime ? (
                            <RuntimeConnectionRow connection={runtime} />
                        ) : (
                            <MissingRuntimeRow />
                        )}
                    </Card>
                </CardFrame>
                {runtime ? (
                    <div className="px-3.5 pt-3">
                        <RuntimeMetadata connection={runtime} />
                    </div>
                ) : null}
            </section>
        </div>
    );
}
