import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Field, FieldError } from '../../../components/ui/primitives/field.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SettingsItem, SettingsRow } from '../../../components/ui/settings-row.tsx';
import { useConnectAgentRuntime } from '../../../hooks/connections/use-connect-agent-runtime.ts';
import { type AgentRuntimeConnectionOutput, trpc } from '../../../lib/trpc.tsx';
import { HermesCapabilitiesSummary } from './hermes-capabilities-table.tsx';

interface AgentRuntimeSettingsPanelProps {
    runtime: AgentRuntimeConnectionOutput;
}

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;

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
            <HermesCapabilitiesSummary
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
    const capabilityMutation = trpc.agentRuntime.refreshCapability.useMutation({
        onSettled: async () => {
            await queryClient.invalidateQueries();
        },
    });

    return (
        <SettingsItem className="p-0">
            <SettingsRow description="The runtime that powers agent work." title="Tavern Runtime">
                <RuntimeUrlForm connection={connection} />
            </SettingsRow>
            {connection.lastError ? null : (
                <div className="border-border/60 border-t p-3.5">
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
                </div>
            )}
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
                <div className="flex max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Input
                        aria-label="Tavern Runtime URL"
                        className="font-mono md:flex-1"
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
                the local dev stack so the server can discover the managed Hermes runtime.
            </p>
        </SettingsItem>
    );
}

export function AgentRuntimeSettingsPanel({ runtime }: AgentRuntimeSettingsPanelProps) {
    return (
        <div className="grid gap-8">
            <section>
                <BadgeDivider className="pb-4">Tavern Runtime</BadgeDivider>
                {runtime?.lastError ? (
                    <Alert className="mb-4" variant="error">
                        <Icon icon={AlertCircleIcon} />
                        <AlertTitle>Tavern Runtime is disconnected.</AlertTitle>
                        <AlertDescription>{runtime.lastError}</AlertDescription>
                    </Alert>
                ) : null}
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
