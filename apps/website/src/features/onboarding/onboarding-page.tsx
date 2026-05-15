import * as React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTheme } from '../../components/theme-provider.tsx';
import { AppShell, AppShellDragRegion } from '../../components/ui/app-shell.tsx';
import { BayerDither } from '../../components/ui/bayer-dither.tsx';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldError, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { useAgentRuntimeConnection } from '../../hooks/connections/use-agent-runtime-connection.ts';
import { useConnectAgentRuntime } from '../../hooks/connections/use-connect-agent-runtime.ts';

const onboardingDitherFadeOrigin: [number, number] = [0.5, 0.4];
const tavernRuntimeUrlPlaceholder = 'http://tavern-runtime.example:4310';

export function OnboardingPage() {
    const navigate = useNavigate();
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const { resolvedTheme } = useTheme();
    const isLight = resolvedTheme === 'light';

    if (agentRuntimeConnection.status === 'checking') {
        return <p className="p-6 text-muted-foreground text-sm">Loading Tavern Runtime…</p>;
    }

    if (agentRuntimeConnection.status !== 'unconfigured') {
        return <Navigate replace to="/dashboard" />;
    }

    return (
        <AppShell className="dashboard-reference-theme select-none bg-background text-foreground">
            <AppShellDragRegion />
            <BayerDither
                className="absolute inset-0 z-0 h-full w-full"
                color={isLight ? '#c8ced6' : '#222222'}
                fadeOrigin={onboardingDitherFadeOrigin}
                fadeRadius={1.2}
            />
            <div className="relative z-10 flex min-h-screen flex-col items-center p-6 md:p-10">
                <div className="flex-[2]" />
                <h1 className="mb-5 text-center font-bold text-4xl text-foreground tracking-tight">
                    Welcome to Tavern
                </h1>
                <Card className="w-full max-w-[580px] shadow-2xl shadow-black/10 backdrop-blur-xl">
                    <CardContent className="px-8 py-8 sm:px-10 sm:py-10">
                        <TavernRuntimeOnboardingForm
                            onConnect={() => {
                                navigate('/dashboard/overview');
                            }}
                        />
                    </CardContent>
                </Card>
                <div className="flex-[4]" />
            </div>
        </AppShell>
    );
}

function TavernRuntimeOnboardingForm({ onConnect }: { onConnect: () => void }) {
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
                <h2 className="font-semibold text-foreground text-lg">Connect Tavern Runtime</h2>
                <p className="text-muted-foreground text-sm leading-6">
                    Enter the Tavern Runtime URL to get started.
                </p>
            </div>

            <Field className="grid gap-2">
                <FieldLabel htmlFor="tavern-runtime-url">Runtime URL</FieldLabel>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                        className="select-text font-mono"
                        id="tavern-runtime-url"
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
