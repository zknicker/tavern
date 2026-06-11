import { AlertCircleIcon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { Refresh04Icon } from '@hugeicons-pro/core-solid-rounded';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../../../components/ui/alert.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SettingsItem, SettingsRow } from '../../../components/ui/settings-row.tsx';
import { Tooltip, TooltipProvider } from '../../../components/ui/tooltip.tsx';
import { useConnectAgentRuntime } from '../../../hooks/connections/use-connect-agent-runtime.ts';
import { type AgentRuntimeConnectionOutput, trpc } from '../../../lib/trpc.tsx';
import { HermesCapabilitiesSummary } from './hermes-capabilities-table.tsx';

interface AgentRuntimeSettingsPanelProps {
    isChecking?: boolean;
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
            <RuntimeUrlForm connection={connection} />
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
    const urlInputId = React.useId();
    const tokenInputId = React.useId();
    const [baseUrl, setBaseUrl] = React.useState(connection.baseUrl);
    const [token, setToken] = React.useState('');
    const connectMutation = useConnectAgentRuntime();
    const trimmedBaseUrl = baseUrl.trim();
    const trimmedToken = token.trim();
    const hasChanged = trimmedBaseUrl !== connection.baseUrl || trimmedToken.length > 0;
    const isEnvironment = connection.source === 'environment';
    const errorMessage = connectMutation.error?.message ?? null;
    const isAuthError =
        errorMessage !== null &&
        (/401|unauthorized/i.test(errorMessage) || errorMessage.includes('Bearer token required'));

    React.useEffect(() => {
        setBaseUrl(connection.baseUrl);
    }, [connection.baseUrl]);

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                if (!(trimmedBaseUrl && hasChanged)) {
                    return;
                }
                connectMutation.mutate({
                    auth: trimmedToken ? { token: trimmedToken } : undefined,
                    baseUrl: trimmedBaseUrl,
                });
            }}
        >
            <SettingsRow description="Where your agent lives." title="Tavern Runtime URL">
                <div className="flex max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Input
                        aria-label="Tavern Runtime URL"
                        className="font-mono md:flex-1"
                        disabled={connectMutation.isPending || isEnvironment}
                        id={urlInputId}
                        name="runtime-url"
                        onChange={(event) => setBaseUrl(event.currentTarget.value)}
                        value={baseUrl}
                    />
                    <Button
                        className="w-fit"
                        disabled={
                            !(trimmedBaseUrl && hasChanged) ||
                            connectMutation.isPending ||
                            isEnvironment
                        }
                        loading={connectMutation.isPending}
                        type="submit"
                        variant="secondary"
                    >
                        Save
                    </Button>
                </div>
            </SettingsRow>
            <SettingsRow
                description="Pairs this app with your runtime."
                error={
                    connectMutation.error
                        ? isAuthError
                            ? 'The runtime requires a token. Run `tavern token` on the runtime host and paste it here.'
                            : errorMessage
                        : null
                }
                title={
                    <span className="inline-flex items-center gap-1.5">
                        Tavern Runtime Token
                        <TooltipProvider>
                            <Tooltip
                                content={
                                    <span>
                                        On the runtime host, run{' '}
                                        <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.92em]">
                                            tavern token
                                        </code>{' '}
                                        to print the pairing token, then paste it here.
                                    </span>
                                }
                            >
                                <span className="inline-flex cursor-default text-muted-foreground">
                                    <Icon
                                        aria-label="How to find your runtime token"
                                        icon={InformationCircleIcon}
                                        size={14}
                                    />
                                </span>
                            </Tooltip>
                        </TooltipProvider>
                    </span>
                }
            >
                <Input
                    aria-label="Runtime token"
                    disabled={connectMutation.isPending || isEnvironment}
                    id={tokenInputId}
                    name="runtime-token"
                    onChange={(event) => setToken(event.currentTarget.value)}
                    placeholder={
                        connection.authConfigured && !trimmedToken
                            ? 'Configured'
                            : 'Run `tavern token` on the runtime host'
                    }
                    type="password"
                    value={token}
                />
            </SettingsRow>
        </form>
    );
}

function MissingRuntimeRow() {
    return (
        <SettingsItem className="grid gap-2 px-3.5 py-3.5">
            <h3 className="font-medium text-foreground text-sm">Tavern Runtime</h3>
            <p className="text-muted-foreground text-sm">
                No managed runtime has reported status yet. Start Tavern through the desktop app or
                the local dev stack so the server can discover the managed agent runtime.
            </p>
        </SettingsItem>
    );
}

export function AgentRuntimeSettingsPanel({
    isChecking = false,
    runtime,
}: AgentRuntimeSettingsPanelProps) {
    const queryClient = useQueryClient();
    const healthMutation = trpc.agentRuntime.checkHealth.useMutation({
        onSettled: async () => {
            await queryClient.invalidateQueries();
        },
    });

    return (
        <div className="grid gap-8">
            <section>
                <BadgeDivider className="pb-4">Tavern Runtime</BadgeDivider>
                {runtime?.lastError ? (
                    <Alert className="mb-4" variant="error">
                        <Icon icon={AlertCircleIcon} />
                        <AlertTitle>Tavern Runtime is unreachable.</AlertTitle>
                        <AlertDescription>
                            Tavern can&apos;t reach this Runtime URL. Check the address, port, and
                            network.
                        </AlertDescription>
                        <AlertAction>
                            <Button
                                loading={healthMutation.isPending}
                                onClick={() => healthMutation.mutate()}
                                size="sm"
                                variant="destructive-soft"
                            >
                                <Icon icon={Refresh04Icon} />
                                Check now
                            </Button>
                        </AlertAction>
                    </Alert>
                ) : null}
                {runtime && isChecking && !runtime.lastError ? (
                    <Alert className="mb-4" variant="info">
                        <Icon className="animate-spin" icon={Refresh04Icon} />
                        <AlertTitle>Checking Tavern Runtime reachability.</AlertTitle>
                        <AlertDescription>
                            Tavern is open with synced data while it checks {runtime.baseUrl}. This
                            can take up to 10 seconds when the Runtime host is unreachable.
                        </AlertDescription>
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
