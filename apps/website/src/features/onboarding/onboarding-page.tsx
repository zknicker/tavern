import { Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import onboardingBackground from '../../assets/tavern-onboarding-background.webp';
import { AppShell, AppShellDragRegion } from '../../components/ui/app-shell.tsx';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldError } from '../../components/ui/primitives/field.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Progress } from '../../components/ui/progress.tsx';
import {
    clearRuntimeUpdateProgress,
    readRuntimeUpdateProgress,
    runtimeUpdateTimeoutMs,
    writeRuntimeUpdateProgress,
} from '../../hooks/connections/runtime-update-progress.ts';
import { useAgentRuntimeConnection } from '../../hooks/connections/use-agent-runtime-connection.ts';
import { useConnectAgentRuntime } from '../../hooks/connections/use-connect-agent-runtime.ts';
import { trpc } from '../../lib/trpc.tsx';

const tavernRuntimeUrlPlaceholder = 'http://127.0.0.1:18790';
const runtimeUpdateSteps = [
    'Ready to update',
    'Starting update',
    'Update started',
    'Waiting for Runtime',
    'Reconnecting',
    'Checking version',
    'Runtime updated',
] as const;

type RuntimeUpdateStep = (typeof runtimeUpdateSteps)[number];
type RuntimeVersionMismatchKind = 'app-needs-update' | 'runtime-needs-update';

type RuntimeConnection = ReturnType<typeof useAgentRuntimeConnection>['connection'];
type RuntimeUpdateConnection = NonNullable<RuntimeConnection>;

export function OnboardingPage() {
    const navigate = useNavigate();
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const connection = agentRuntimeConnection.connection;
    const isVersionMismatch = agentRuntimeConnection.status === 'version-mismatch';
    const mismatchKind = connection ? getRuntimeVersionMismatchKind(connection) : null;

    React.useEffect(() => {
        if (connection?.versionStatus === 'matched') {
            clearRuntimeUpdateProgress();
        }
    }, [connection?.versionStatus]);

    if (agentRuntimeConnection.status === 'checking') {
        return <p className="p-6 text-muted-foreground text-sm">Loading Tavern Runtime…</p>;
    }

    if (
        !['error', 'unconfigured', 'unreachable', 'version-mismatch'].includes(
            agentRuntimeConnection.status
        )
    ) {
        return <Navigate replace to="/dashboard" />;
    }

    return (
        <AppShell className="dashboard-reference-theme select-none overflow-hidden bg-background text-foreground">
            <AppShellDragRegion />
            <OnboardingBackground />
            <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-8 md:px-10">
                <div className="grid w-full justify-items-center">
                    <div className="mb-7 grid max-w-[1040px] gap-4 text-center text-white">
                        <h1 className="max-w-full justify-self-center text-nowrap text-balance font-display font-semibold text-4xl text-white drop-shadow-[0_10px_28px_rgb(49_25_11_/_0.34)] [font-kerning:normal] [text-rendering:optimizeLegibility] sm:text-5xl">
                            {isVersionMismatch
                                ? mismatchKind === 'app-needs-update'
                                    ? 'Update Tavern!'
                                    : 'Time to update!'
                                : 'Welcome in, traveler!'}
                        </h1>
                    </div>
                    <RuntimeConnectionCard
                        connection={connection}
                        onConnect={() => {
                            navigate('/dashboard/overview');
                        }}
                        status={agentRuntimeConnection.status}
                    />
                </div>
            </div>
        </AppShell>
    );
}

function OnboardingBackground() {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden">
            <img
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-[1.02] object-cover brightness-[1.08] saturate-[1.08]"
                height={941}
                src={onboardingBackground}
                width={1672}
            />
            <img
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-[1.12] object-cover blur-[16px] brightness-[1.05] saturate-[1.05] [mask-image:radial-gradient(ellipse_490px_350px_at_50%_50%,black_0%,black_46%,rgb(0_0_0_/_0.72)_68%,transparent_100%)]"
                height={941}
                src={onboardingBackground}
                width={1672}
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(255_248_232_/_0.2),rgb(255_255_255_/_0.04)_42%,rgb(67_38_20_/_0.12)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_510px_360px_at_50%_50%,rgb(36_19_13_/_0.34)_0%,rgb(33_20_15_/_0.22)_60%,transparent_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_460px_315px_at_50%_45%,rgb(0_0_0_/_0.16)_0%,transparent_74%)]" />
        </div>
    );
}

function RuntimeConnectionCard({
    connection,
    status,
    onConnect,
}: {
    connection: RuntimeConnection;
    status: ReturnType<typeof useAgentRuntimeConnection>['status'];
    onConnect: () => void;
}) {
    return (
        <Card className="w-full max-w-[620px] rounded-[8px] border-white/42 bg-white/72 text-neutral-900 shadow-[0_26px_80px_rgb(17_24_39_/_0.24),inset_0_1px_rgb(255_255_255_/_0.72)] backdrop-blur-2xl">
            <CardContent className="px-8 py-7 sm:px-10 sm:py-9">
                {status === 'version-mismatch' && connection ? (
                    <RuntimeUpdatePanel connection={connection} />
                ) : (
                    <TavernRuntimeOnboardingForm connection={connection} onConnect={onConnect} />
                )}
            </CardContent>
        </Card>
    );
}

function TavernRuntimeOnboardingForm({
    connection,
    onConnect,
}: {
    connection: RuntimeConnection;
    onConnect: () => void;
}) {
    const runtimeUrlInputId = React.useId();
    const [baseUrl, setBaseUrl] = React.useState(connection?.baseUrl ?? '');
    const connectMutation = useConnectAgentRuntime({
        onSuccess: onConnect,
    });
    const errorMessage = connectMutation.error?.message ?? null;

    React.useEffect(() => {
        setBaseUrl((current) => current || connection?.baseUrl || '');
    }, [connection?.baseUrl]);

    return (
        <form
            className="grid gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                if (!baseUrl.trim()) {
                    return;
                }
                connectMutation.mutate({
                    baseUrl: baseUrl.trim(),
                });
            }}
        >
            <div className="grid gap-1.5">
                <p className="max-w-[54ch] text-pretty text-base text-neutral-700 leading-7">
                    The Tavern Runtime is where your agents live, store their memories, and work on
                    tasks. Once you have it up and running, connect to it here.
                </p>
            </div>

            <Field>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                        aria-label="Tavern Runtime URL"
                        className="select-text border-white/60 bg-white/64 font-mono text-neutral-900 shadow-inner shadow-neutral-900/5 hover:border-white/80 hover:bg-white/82"
                        id={runtimeUrlInputId}
                        name="runtime-url"
                        onChange={(event) => setBaseUrl(event.currentTarget.value)}
                        placeholder={tavernRuntimeUrlPlaceholder}
                        size="lg"
                        value={baseUrl}
                    />
                    <Button
                        className="border-brand bg-brand text-brand-foreground shadow-brand/20 hover:bg-brand/90"
                        disabled={!baseUrl.trim()}
                        loading={connectMutation.isPending}
                        size="lg"
                        type="submit"
                    >
                        Connect
                    </Button>
                </div>
            </Field>
            {connection?.lastError ? (
                <FieldError>Could not reach Tavern Runtime: {connection.lastError}</FieldError>
            ) : null}
            {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        </form>
    );
}

function RuntimeUpdatePanel({ connection }: { connection: RuntimeUpdateConnection }) {
    const utils = trpc.useUtils();
    const storedProgress = readRuntimeUpdateProgress();
    const mismatchKind = getRuntimeVersionMismatchKind(connection);
    const isAppUpdateRequired = mismatchKind === 'app-needs-update';
    const [now, setNow] = React.useState(() => Date.now());
    const [startedAt, setStartedAt] = React.useState<string | null>(
        storedProgress?.startedAt ?? null
    );
    const [stepIndex, setStepIndex] = React.useState(storedProgress ? 3 : 0);
    const [started, setStarted] = React.useState(Boolean(storedProgress));
    const updateMutation = trpc.agentRuntime.startUpdate.useMutation({
        onSuccess: (result) => {
            writeRuntimeUpdateProgress({
                baseUrl: connection.baseUrl,
                requiredVersion: connection.appVersion,
                runtimeVersion: connection.runtimeVersion,
                startedAt: result.startedAt,
            });
            setStarted(true);
            setStartedAt(result.startedAt);
            setStepIndex(2);
        },
    });
    const checkHealthMutation = trpc.agentRuntime.checkHealth.useMutation({
        onSettled: async () => {
            await utils.agentRuntime.get.invalidate();
        },
    });
    const checkHealthRef = React.useRef(checkHealthMutation.mutate);
    const disconnectMutation = trpc.agentRuntime.disconnect.useMutation({
        onSuccess: async () => {
            clearRuntimeUpdateProgress();
            await utils.agentRuntime.get.invalidate();
        },
    });
    const currentStep = runtimeUpdateSteps[stepIndex] ?? runtimeUpdateSteps[0];
    const progress = (stepIndex / (runtimeUpdateSteps.length - 1)) * 100;
    const updateAge = startedAt ? now - Date.parse(startedAt) : 0;
    const hasTimedOut =
        startedAt !== null && Number.isFinite(updateAge) && updateAge >= runtimeUpdateTimeoutMs;
    const isUpdateInProgress =
        !isAppUpdateRequired &&
        started &&
        !hasTimedOut &&
        stepIndex > 0 &&
        stepIndex < runtimeUpdateSteps.length - 1;
    const updatePrompt = hasTimedOut
        ? 'Update needs attention'
        : isUpdateInProgress
          ? 'Update is in progress!'
          : currentStep === 'Runtime updated' && !isAppUpdateRequired
            ? 'Runtime updated!'
            : isAppUpdateRequired
              ? 'Update Tavern to continue'
              : 'Ready to update?';

    React.useEffect(() => {
        checkHealthRef.current = checkHealthMutation.mutate;
    }, [checkHealthMutation.mutate]);

    React.useEffect(() => {
        if (!(started && !hasTimedOut && !isAppUpdateRequired)) {
            return;
        }

        const interval = window.setInterval(() => {
            setStepIndex((current) => Math.min(current + 1, runtimeUpdateSteps.length - 2));
            checkHealthRef.current();
        }, 2500);

        return () => window.clearInterval(interval);
    }, [hasTimedOut, isAppUpdateRequired, started]);

    React.useEffect(() => {
        if (!startedAt) {
            return;
        }
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, [startedAt]);

    return (
        <div className="grid gap-5">
            <div className="grid gap-4">
                <p className="text-pretty text-[#5b4637] text-base leading-6">
                    {isAppUpdateRequired
                        ? 'Tavern is connected to a newer Runtime than this app supports. Update Tavern, then reopen the app.'
                        : 'Tavern is connected to your Runtime, but this app needs a newer Runtime before the dashboard can open.'}
                </p>
                <div className="grid gap-2 rounded-[8px] border border-[#d8b98d]/70 bg-white/46 px-3 py-3 text-sm">
                    <VersionRow label="Required" value={`v${connection.appVersion}`} />
                    <VersionRow
                        label="Connected"
                        value={
                            connection.runtimeVersion ? `v${connection.runtimeVersion}` : 'Unknown'
                        }
                    />
                    <VersionRow label="Runtime" value={connection.baseUrl} />
                </div>
            </div>

            <div className="grid gap-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="font-medium text-[#2a1b12] text-sm">{updatePrompt}</p>
                        <p className="text-[#715a48] text-sm">
                            {isAppUpdateRequired ? 'Runtime is already newer' : currentStep}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            className="text-[#5b4637] hover:bg-[#8a5f3e]/8 hover:text-[#2a1b12]"
                            loading={disconnectMutation.isPending}
                            onClick={() => {
                                disconnectMutation.mutate();
                            }}
                            size="lg"
                            type="button"
                            variant="ghost"
                        >
                            Disconnect
                        </Button>
                        {isAppUpdateRequired ? null : (
                            <Button
                                className="border-brand bg-brand text-brand-foreground shadow-brand/20 hover:bg-brand/90"
                                disabled={started && !hasTimedOut}
                                loading={updateMutation.isPending || isUpdateInProgress}
                                onClick={() => {
                                    setStepIndex(1);
                                    updateMutation.mutate();
                                }}
                                size="lg"
                                type="button"
                            >
                                Update
                            </Button>
                        )}
                    </div>
                </div>

                {isAppUpdateRequired ? null : (
                    <>
                        <Progress
                            className="h-2.5 bg-[#d5c2aa]/70"
                            color="var(--brand)"
                            value={progress}
                        />
                        <UpdateStepList currentStep={currentStep} />
                    </>
                )}
                {hasTimedOut ? (
                    <FieldError>
                        Runtime update is taking longer than expected. Tavern stopped polling after
                        10 minutes; retry the update or change Runtime.
                    </FieldError>
                ) : null}
                {updateMutation.error ? (
                    <FieldError>{updateMutation.error.message}</FieldError>
                ) : null}
                {checkHealthMutation.error && !hasTimedOut ? (
                    <FieldError>{checkHealthMutation.error.message}</FieldError>
                ) : null}
            </div>
        </div>
    );
}

function getRuntimeVersionMismatchKind(
    connection: RuntimeUpdateConnection | null
): RuntimeVersionMismatchKind {
    const comparison = compareRuntimeVersions(connection?.runtimeVersion, connection?.appVersion);
    return comparison > 0 ? 'app-needs-update' : 'runtime-needs-update';
}

function compareRuntimeVersions(runtimeVersion?: null | string, appVersion?: null | string) {
    if (!(runtimeVersion && appVersion)) {
        return -1;
    }

    const runtimeParts = toVersionParts(runtimeVersion);
    const appParts = toVersionParts(appVersion);
    const maxLength = Math.max(runtimeParts.length, appParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const runtimePart = runtimeParts[index] ?? 0;
        const appPart = appParts[index] ?? 0;
        if (runtimePart !== appPart) {
            return runtimePart > appPart ? 1 : -1;
        }
    }

    return 0;
}

function toVersionParts(version: string) {
    return version
        .split(/[^\d]+/)
        .filter(Boolean)
        .map((part) => Number(part));
}

function VersionRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-3">
            <span className="text-[#7a6656]">{label}</span>
            <span className="truncate font-mono text-[#2a1b12]">{value}</span>
        </div>
    );
}

function UpdateStepList({ currentStep }: { currentStep: RuntimeUpdateStep }) {
    const currentIndex = runtimeUpdateSteps.indexOf(currentStep);

    return (
        <div className="grid gap-1.5">
            {runtimeUpdateSteps.slice(1).map((step, index) => {
                const stepNumber = index + 1;
                const isDone = stepNumber < currentIndex;
                const isCurrent = stepNumber === currentIndex;
                return (
                    <div
                        className="grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 text-sm"
                        key={step}
                    >
                        <StepMarker current={isCurrent} done={isDone} />
                        <span className={isDone || isCurrent ? 'text-[#2a1b12]' : 'text-[#715a48]'}>
                            {step}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function StepMarker({ current, done }: { current: boolean; done: boolean }) {
    if (done) {
        return (
            <span className="grid size-4 place-items-center">
                <Icon className="size-3.5 text-[#2a1b12]" icon={Tick02Icon} strokeWidth={2.6} />
            </span>
        );
    }

    return (
        <span className="grid size-4 place-items-center">
            <span
                className={
                    current
                        ? 'size-2.5 rounded-full bg-brand shadow-[0_0_0_4px_var(--brand-ring)]'
                        : 'size-2.5 rounded-full bg-[#c7b299]'
                }
            />
        </span>
    );
}
