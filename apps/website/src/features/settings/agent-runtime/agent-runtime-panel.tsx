import { AlertCircleIcon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { Refresh04Icon } from '@hugeicons-pro/core-solid-rounded';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../../../components/ui/alert.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SecretInput } from '../../../components/ui/secret-input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { Tooltip, TooltipProvider } from '../../../components/ui/tooltip.tsx';
import {
    getRuntimeVersionMismatchDescription,
    getRuntimeVersionMismatchReason,
} from '../../../hooks/connections/runtime-version-gate.ts';
import { useConnectAgentRuntime } from '../../../hooks/connections/use-connect-agent-runtime.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { type AgentRuntimeConnectionOutput, trpc } from '../../../lib/trpc.tsx';
import { AgentCapabilitiesSummary } from './agent-capabilities-table.tsx';
import { AutoDispatchSection } from './auto-dispatch-section.tsx';
import { TimezoneSection } from './timezone-section.tsx';

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
            <AgentCapabilitiesSummary
                capabilities={capabilities}
                emptyLabel={emptyLabel}
                onCapabilityClick={onCapabilityClick}
                onCapabilityRefresh={onCapabilityRefresh}
                refreshingCapability={refreshingCapability}
            />
        </div>
    );
}

function RuntimeCapabilitiesGroup({ connection }: { connection: RuntimeConnection }) {
    const location = useLocation();
    const queryClient = useQueryClient();
    const capabilityMutation = trpc.agentRuntime.refreshCapability.useMutation({
        onSettled: async () => {
            await queryClient.invalidateQueries();
        },
    });
    const previewConnection = getRuntimeCompatibilityPreviewConnection(connection, location.search);
    const compatibilityConnection = previewConnection ?? connection;
    const showCompatibilityAlert =
        connection.versionStatus === 'mismatched' || previewConnection !== null;

    return (
        <SettingsGroup contentClassName="p-3.5">
            {showCompatibilityAlert ? (
                <RuntimeCompatibilityAlert connection={compatibilityConnection} />
            ) : null}
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
        </SettingsGroup>
    );
}

function RuntimeConnectionContent({ connection }: { connection: RuntimeConnection | null }) {
    return (
        <SettingsGroup>
            {connection ? <RuntimeUrlForm connection={connection} /> : <MissingRuntimeRow />}
        </SettingsGroup>
    );
}

function getRuntimeCompatibilityPreviewConnection(
    connection: RuntimeConnection,
    search: string
): RuntimeConnection | null {
    if (!import.meta.env.DEV) {
        return null;
    }

    if (new URLSearchParams(search).get('previewRuntimeMismatch') !== 'old') {
        return null;
    }

    return {
        ...connection,
        runtimeVersion: getPreviewOldRuntimeVersion(connection.requiredRuntimeVersion),
        versionStatus: 'mismatched',
    };
}

function getPreviewOldRuntimeVersion(version: string) {
    const parts = version.split('.').map((part) => Number.parseInt(part, 10));
    const [major, minor, patch] = parts;

    if (
        parts.length === 3 &&
        Number.isFinite(major) &&
        Number.isFinite(minor) &&
        Number.isFinite(patch) &&
        patch > 0
    ) {
        return `${major}.${minor}.${patch - 1}`;
    }

    return `${version}-preview-old`;
}

function RuntimeCompatibilityAlert({ connection }: { connection: RuntimeConnection }) {
    return (
        <Alert className="mb-3" variant="error">
            <Icon icon={AlertCircleIcon} />
            <AlertTitle>{getRuntimeVersionMismatchReason(connection)}</AlertTitle>
            <AlertDescription>{getRuntimeVersionMismatchDescription(connection)}</AlertDescription>
            <AlertAction>
                <Button
                    render={<NavLink to={appRoutes.settingsUpdates} />}
                    variant="destructive-soft"
                >
                    Open Updates
                </Button>
            </AlertAction>
        </Alert>
    );
}

function RuntimeUrlForm({ connection }: { connection: RuntimeConnection }) {
    const urlInputId = React.useId();
    const [baseUrl, setBaseUrl] = React.useState(connection.baseUrl);
    const [token, setToken] = React.useState('');
    const [tokenRevealed, setTokenRevealed] = React.useState(false);
    const connectMutation = useConnectAgentRuntime();
    const trimmedBaseUrl = baseUrl.trim();
    const trimmedToken = token.trim();
    const hasChanged = trimmedBaseUrl !== connection.baseUrl || trimmedToken.length > 0;
    const isEnvironment = connection.source === 'environment';
    const errorMessage = connectMutation.error?.message ?? null;
    const isAuthError =
        errorMessage !== null &&
        (/401|unauthorized/i.test(errorMessage) ||
            errorMessage.includes('Bearer token required') ||
            errorMessage.includes('Bearer token invalid'));

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
                    auth: trimmedToken ? { kind: 'token', token: trimmedToken } : undefined,
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
            <Separator />
            <SettingsRow
                description="Pairs this app with your runtime."
                error={
                    connectMutation.error
                        ? isAuthError
                            ? 'The runtime token is missing or invalid. Run `tavern token` on the runtime host and paste the current token here.'
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
                <SecretInput
                    ariaLabel="Runtime token"
                    disabled={connectMutation.isPending || isEnvironment}
                    name="runtime-token"
                    onChange={setToken}
                    onRevealToggle={() => setTokenRevealed((revealed) => !revealed)}
                    placeholder={
                        connection.authConfigured && !trimmedToken
                            ? '••••••••••••••••'
                            : 'Run `tavern token` on the runtime host'
                    }
                    revealed={tokenRevealed}
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
        <SettingsPage>
            <SettingsPageHeader title="Tavern Runtime" />
            <SettingsSection title="Connection">
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
                <RuntimeConnectionContent connection={runtime} />
            </SettingsSection>
            <TimezoneSection />
            <AutoDispatchSection />
            {runtime && !runtime.lastError ? (
                <SettingsSection title="Status">
                    <RuntimeCapabilitiesGroup connection={runtime} />
                </SettingsSection>
            ) : null}
        </SettingsPage>
    );
}
