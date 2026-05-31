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
    title,
}: {
    capabilities: RuntimeConnection['capabilities'];
    emptyLabel: string;
    onCapabilityClick?: (capability: RuntimeConnection['capabilities'][number]) => void;
    onCapabilityRefresh?: (capability: RuntimeConnection['capabilities'][number]) => void;
    refreshingCapability?: RuntimeConnection['capabilities'][number]['capability'] | null;
    title: string;
}) {
    return (
        <div className="space-y-2">
            <p className="font-medium text-muted-foreground text-xs">{title}</p>
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
        <SettingsItem className="flex flex-col gap-3 px-3.5 pt-3.5 pb-1.5">
            <div className="grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(18rem,32rem)] md:items-start md:gap-6">
                <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground text-sm">Tavern Runtime</h3>
                        {healthBadge ? (
                            <Badge size="sm" variant={healthBadge.variant}>
                                {healthBadge.label}
                            </Badge>
                        ) : null}
                    </div>
                    <p className="truncate font-mono text-meta text-muted-foreground">
                        {connection.baseUrl}
                    </p>
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
            <p className="text-muted-foreground text-sm">
                Tavern owns this local OpenClaw runtime, its generated config, and its Seatbelt
                guardrails. OpenClaw is not configured as a separate app connection.
            </p>
            {connection.runtimeVersion ? (
                <p className="text-muted-foreground text-sm">
                    App v{connection.appVersion} · Runtime v{connection.runtimeVersion} · Minimum
                    Runtime v{connection.requiredRuntimeVersion}
                </p>
            ) : null}
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
                title="Runtime capabilities"
            />
        </SettingsItem>
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
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                        aria-label="Tavern Runtime URL"
                        className="font-mono"
                        disabled={connectMutation.isPending || connection.source === 'environment'}
                        id={inputId}
                        name="runtime-url"
                        onChange={(event) => setBaseUrl(event.currentTarget.value)}
                        value={baseUrl}
                    />
                    <Button
                        disabled={
                            !(trimmedBaseUrl && hasChanged) ||
                            connectMutation.isPending ||
                            connection.source === 'environment'
                        }
                        loading={connectMutation.isPending}
                        size="sm"
                        type="submit"
                        variant="secondary"
                    >
                        Save URL
                    </Button>
                </div>
            </Field>
            {connection.source === 'environment' ? (
                <p className="text-muted-foreground text-xs">
                    Runtime URL is set by `TAVERN_RUNTIME_URL`.
                </p>
            ) : null}
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
            </section>
        </div>
    );
}
