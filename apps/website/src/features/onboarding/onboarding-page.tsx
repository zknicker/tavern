import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DesktopUpdateIndicator } from '../../components/desktop-update-indicator.tsx';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert.tsx';
import { AppShell, AppShellDragRegion } from '../../components/ui/app-shell.tsx';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldDescription, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { useConnectAgentRuntime } from '../../hooks/connections/use-connect-agent-runtime.ts';
import { useRuntimeConnection } from '../../hooks/connections/use-runtime-connection.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { ClaimCommand } from './claim-command.tsx';

const tavernRuntimeUrlPlaceholder = 'http://127.0.0.1:18790';

type RuntimeConnection = ReturnType<typeof useRuntimeConnection>['connection'];

export function OnboardingPage() {
    const navigate = useNavigate();
    const runtimeConnection = useRuntimeConnection();
    const connection = runtimeConnection.connection;

    if (runtimeConnection.status === 'checking') {
        return <p className="p-6 text-muted-foreground text-sm">Loading Grotto Runtime…</p>;
    }

    if (connection?.enabled || !['error', 'unconfigured'].includes(runtimeConnection.status)) {
        return <Navigate replace to={appRoutes.activity} />;
    }

    return (
        <AppShell className="app-reference-theme select-none overflow-hidden bg-background text-foreground">
            <AppShellDragRegion />
            <DesktopUpdateIndicator placement="floating" />
            <div className="flex min-h-screen flex-col items-center justify-center px-6 py-8">
                <div className="grid w-full max-w-lg gap-6">
                    <div className="grid gap-1.5 text-center">
                        <h1 className="font-semibold text-2xl text-foreground">
                            Connect your runtime
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Grotto Runtime is where your agents live, store their memories, and work
                            on tasks.
                        </p>
                    </div>
                    <Card>
                        <CardContent className="p-6 sm:p-8">
                            <TavernRuntimeOnboardingForm
                                connection={connection}
                                onConnect={() => {
                                    navigate(appRoutes.activity);
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppShell>
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
    const runtimeTokenInputId = React.useId();
    const runtimeUrlErrorId = React.useId();
    const [baseUrl, setBaseUrl] = React.useState(connection?.baseUrl ?? '');
    const [token, setToken] = React.useState('');
    const connectMutation = useConnectAgentRuntime({
        onSuccess: onConnect,
    });
    const errorMessage = connectMutation.error?.message ?? null;
    const isAuthError =
        errorMessage !== null &&
        (/401|unauthorized/i.test(errorMessage) ||
            errorMessage.includes('Bearer token required') ||
            errorMessage.includes('Bearer token invalid'));
    const displayErrorMessage = isAuthError
        ? token.trim()
            ? 'The runtime token is invalid. Run `grotto token` on the runtime host and paste the current token here.'
            : 'Your signed-in account could not access this runtime. Ask the owner for an invite, then try again.'
        : errorMessage
          ? formatRuntimeConnectionError(errorMessage)
          : null;
    const runtimeConnectionError = displayErrorMessage
        ? {
              message: displayErrorMessage,
              title: isAuthError ? 'Token required' : 'Connection failed',
          }
        : connection?.lastError
          ? {
                message: formatRuntimeConnectionError(connection.lastError),
                title: 'Grotto Runtime is unreachable',
            }
          : null;

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
                const trimmedToken = token.trim();
                connectMutation.mutate({
                    auth: trimmedToken ? { kind: 'token', token: trimmedToken } : undefined,
                    baseUrl: baseUrl.trim(),
                });
            }}
        >
            <ClaimCommand />

            <Field>
                <FieldLabel htmlFor={runtimeUrlInputId}>Runtime URL</FieldLabel>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                        aria-describedby={runtimeConnectionError ? runtimeUrlErrorId : undefined}
                        aria-invalid={Boolean(runtimeConnectionError)}
                        className="select-text font-mono"
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

            <Field>
                <FieldLabel htmlFor={runtimeTokenInputId}>
                    Owner runtime token (optional)
                </FieldLabel>
                <Input
                    className="select-text"
                    id={runtimeTokenInputId}
                    name="runtime-token"
                    onChange={(event) => setToken(event.currentTarget.value)}
                    size="lg"
                    type="password"
                    value={token}
                />
                <FieldDescription>
                    Owners paste the token from <code>grotto token</code>. Invited members leave
                    this blank.
                </FieldDescription>
            </Field>

            {runtimeConnectionError ? (
                <RuntimeConnectionError
                    id={runtimeUrlErrorId}
                    message={runtimeConnectionError.message}
                    title={runtimeConnectionError.title}
                />
            ) : null}
        </form>
    );
}

function RuntimeConnectionError({
    id,
    message,
    title,
}: {
    id: string;
    message: string;
    title: string;
}) {
    return (
        <Alert id={id} variant="error">
            <Icon className="size-4 text-error" icon={AlertCircleIcon} />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}

function formatRuntimeConnectionError(message: string) {
    const normalized = message.trim().replace(/\burl\b/gi, 'URL');

    if (/^Unable to connect\. Is the computer able to access the URL\??$/i.test(normalized)) {
        return 'Unable to connect. Check that this computer can access the URL.';
    }

    return normalized || 'Check that Grotto Runtime is running and this computer can access it.';
}
