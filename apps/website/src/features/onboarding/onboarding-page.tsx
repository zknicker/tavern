import * as React from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import onboardingBackground from '../../assets/tavern-onboarding-background.webp';
import { AppShell, AppShellDragRegion } from '../../components/ui/app-shell.tsx';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldError } from '../../components/ui/primitives/field.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { useAgentRuntimeConnection } from '../../hooks/connections/use-agent-runtime-connection.ts';
import { useConnectAgentRuntime } from '../../hooks/connections/use-connect-agent-runtime.ts';

const tavernRuntimeUrlPlaceholder = 'http://127.0.0.1:4310';

export function OnboardingPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const isPreview = searchParams.get('preview') === '1';

    if (!isPreview && agentRuntimeConnection.status === 'checking') {
        return <p className="p-6 text-muted-foreground text-sm">Loading Tavern Runtime…</p>;
    }

    if (!isPreview && agentRuntimeConnection.status === 'reachable') {
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
                            Welcome in, traveler!
                        </h1>
                    </div>
                    <RuntimeConnectionCard
                        onConnect={() => {
                            navigate('/dashboard/overview');
                        }}
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

function RuntimeConnectionCard({ onConnect }: { onConnect: () => void }) {
    return (
        <Card className="w-full max-w-[620px] rounded-[8px] border-white/42 bg-white/72 text-neutral-900 shadow-[0_26px_80px_rgb(17_24_39_/_0.24),inset_0_1px_rgb(255_255_255_/_0.72)] backdrop-blur-2xl">
            <CardContent className="px-8 py-7 sm:px-10 sm:py-9">
                <TavernRuntimeOnboardingForm onConnect={onConnect} />
            </CardContent>
        </Card>
    );
}

function TavernRuntimeOnboardingForm({ onConnect }: { onConnect: () => void }) {
    const runtimeUrlInputId = React.useId();
    const [baseUrl, setBaseUrl] = React.useState('');
    const connectMutation = useConnectAgentRuntime({
        onSuccess: onConnect,
    });
    const errorMessage = connectMutation.error?.message ?? null;

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
                        disabled={!baseUrl.trim()}
                        loading={connectMutation.isPending}
                        size="lg"
                        type="submit"
                    >
                        Connect
                    </Button>
                </div>
            </Field>
            {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        </form>
    );
}
