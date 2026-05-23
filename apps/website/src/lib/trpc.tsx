import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWSClient, httpLink, loggerLink, splitLink, wsLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import * as React from 'react';
import type { AppRouter } from '../../../server/src/api/router.ts';
import { TrpcEventListeners } from '../components/trpc-event-listeners.tsx';
import { ChatStartDraftProvider } from '../hooks/chats/use-chat-start-drafts.tsx';
import { ChatTimelineProvider } from '../hooks/chats/use-chat-timeline-store.tsx';
import { TimelineContextProvider } from '../hooks/chats/use-timeline-context.tsx';
import {
    ensureDesktopServerOrigin,
    getConfiguredServerOrigin,
    isPackagedTauriApp,
} from './agent-runtime.ts';
import { queryClientDefaultOptions } from './query-policy.ts';

export const trpc = createTRPCReact<AppRouter>();

type RouterOutput = inferRouterOutputs<AppRouter>;

export type AppRouterOutputs = RouterOutput;
export type AgentOutput = RouterOutput['agent']['get'];
export type AgentActivityOutput = RouterOutput['agent']['activity'];
export type AgentListOutput = RouterOutput['agent']['list'];
export type PrimaryAgentOutput = RouterOutput['agent']['primary'];
export type ChatGetOutput = RouterOutput['chat']['get'];
export type ChatListOutput = RouterOutput['chat']['list'];
export type ChatLogOutput = RouterOutput['chat']['log']['list'];
export type ChatToolOutput = RouterOutput['chat']['tool']['get'];
export type CortexListOutput = RouterOutput['cortex']['list'];
export type CortexPageOutput = RouterOutput['cortex']['get'];
export type CortexStatusOutput = RouterOutput['cortex']['status'];
export type JobsListOutput = RouterOutput['jobs']['list'];
export type JobDetailOutput = RouterOutput['jobs']['get']['job'];
export type JobRecentRunsOutput = RouterOutput['jobs']['recentRuns'];
export type LogListOutput = RouterOutput['log']['list'];
export type MemorySettingsOutput = RouterOutput['memory']['get'];
export type MemoryStatusOutput = RouterOutput['memory']['status'];
export type MentionInventoryOutput = RouterOutput['mention']['inventory'];
export type MentionPathOutput = RouterOutput['mention']['paths'];
export type ModelListOutput = RouterOutput['model']['list'];
export type ModelInventoryOutput = RouterOutput['model']['inventory'];
export type OpenClawConfigOutput = RouterOutput['openClawConfig']['get'];
export type CronDeliveryTargetsOutput = RouterOutput['cron']['deliveryTargets'];
export type CronGetOutput = RouterOutput['cron']['get'];
export type CronListOutput = RouterOutput['cron']['list'];
export type CronRunsOutput = RouterOutput['cron']['runs'];
export type MessagingPlatformListOutput = RouterOutput['messagingPlatform']['list'];
export type LiveUsageOutput = RouterOutput['usage']['live'];
export type AgentRuntimeConnectionOutput = RouterOutput['agentRuntime']['get'];
export type ModelAccessOutput = RouterOutput['modelAccess']['get'];
export type OpenRouterSettingsOutput = RouterOutput['openRouterSettings']['get'];
export type ParticipantListOutput = RouterOutput['participant']['list'];
export type SessionListOutput = RouterOutput['session']['list'];
export type SessionHistoryOutput = RouterOutput['session']['history']['get'];
export type SessionPromptOutput = RouterOutput['session']['prompt']['get'];
export type HistoryActorOutput = NonNullable<
    Extract<SessionHistoryOutput['rows'][number], { kind: 'message' }>['actor']
>;
export type SessionHistoryMessageRowOutput = Extract<
    SessionHistoryOutput['rows'][number],
    { kind: 'message' }
>;
export type SessionHistoryToolCallOutput = Extract<
    SessionHistoryOutput['rows'][number],
    { kind: 'tool' }
>['toolCall'];
export type SessionHistoryWorkerRowOutput = Extract<
    SessionHistoryOutput['rows'][number],
    { kind: 'worker' }
>;
export type SessionHistorySystemRowOutput = Extract<
    SessionHistoryOutput['rows'][number],
    { kind: 'system' }
>;
export type SessionRelationshipOutput = NonNullable<SessionHistoryOutput['parentRelationship']>;
export type SessionHistoryAccessEventRowOutput = Extract<
    SessionHistorySystemRowOutput,
    { systemKind: 'accessEvent' }
>;
export type SessionHistoryArtifactRowOutput = Extract<
    SessionHistorySystemRowOutput,
    { systemKind: 'artifact' }
>;
export type SessionHistoryDeliveryOutput = Extract<
    SessionHistorySystemRowOutput,
    { systemKind: 'delivery' }
>['delivery'];
export type SessionHistoryThinkingRowOutput = Extract<
    SessionHistorySystemRowOutput,
    { systemKind: 'thinking' }
>;
export type SessionOutput = RouterOutput['session']['get'];
export type SessionMetadataOutput = SessionOutput['session'];
export type SessionToolOutput = RouterOutput['session']['tool']['get'];
export type SkillListOutput = RouterOutput['skill']['list'];
export type SkillRuntimeListOutput = RouterOutput['skill']['runtimeList'];
export type SkillGetOutput = RouterOutput['skill']['get'];
export type SubAgentListOutput = RouterOutput['subAgent']['list'];
export type WorkerListOutput = RouterOutput['worker']['list'];

function getTrpcUrl(serverOrigin: string | null) {
    if (!serverOrigin) {
        return '/trpc';
    }

    return new URL('/trpc', serverOrigin).toString();
}

function getTrpcWebSocketUrl(serverOrigin: string | null) {
    const url = serverOrigin
        ? new URL('/trpc', serverOrigin)
        : new URL('/trpc', window.location.origin);

    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    return url.toString();
}

function createTrpcClient(serverOrigin: string | null) {
    const wsClient = createWSClient({
        url: getTrpcWebSocketUrl(serverOrigin),
    });
    const trpcUrl = getTrpcUrl(serverOrigin);

    return {
        client: trpc.createClient({
            links: [
                loggerLink({
                    enabled: () => {
                        if (!import.meta.env.DEV) {
                            return false;
                        }

                        return true;
                    },
                    colorMode: 'css',
                }),
                splitLink({
                    condition: (operation) => operation.type === 'subscription',
                    false: httpLink({
                        methodOverride: 'POST',
                        url: trpcUrl,
                    }),
                    true: wsLink({
                        client: wsClient,
                    }),
                }),
            ],
        }),
        wsClient,
    };
}

export function TavernProviders({ children }: React.PropsWithChildren) {
    const [queryClient] = React.useState(
        () =>
            new QueryClient({
                defaultOptions: queryClientDefaultOptions,
            })
    );

    const [agentRuntimeError, setAgentRuntimeError] = React.useState<Error | null>(null);
    const [serverOrigin, setServerOrigin] = React.useState<string | null>(
        getConfiguredServerOrigin()
    );
    const [isAgentRuntimeReady, setIsAgentRuntimeReady] = React.useState(!isPackagedTauriApp());

    React.useEffect(() => {
        if (!isPackagedTauriApp()) {
            return;
        }

        let cancelled = false;

        ensureDesktopServerOrigin()
            .then((origin) => {
                if (cancelled) {
                    return;
                }

                setServerOrigin(origin);
                setIsAgentRuntimeReady(true);
            })
            .catch((error) => {
                if (cancelled) {
                    return;
                }

                setAgentRuntimeError(
                    error instanceof Error
                        ? error
                        : new Error('Failed to start Tavern desktop backend.')
                );
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const clientState = React.useMemo(() => {
        if (!isAgentRuntimeReady) {
            return null;
        }

        return createTrpcClient(serverOrigin);
    }, [isAgentRuntimeReady, serverOrigin]);

    React.useEffect(() => {
        return () => {
            clientState?.wsClient.close();
        };
    }, [clientState]);

    if (agentRuntimeError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
                <div>
                    <p className="font-medium text-lg">
                        Tavern failed to start its desktop backend.
                    </p>
                    <p className="mt-2 text-muted-foreground text-sm">
                        {agentRuntimeError.message}
                    </p>
                </div>
            </div>
        );
    }

    if (!isAgentRuntimeReady) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-muted-foreground">
                Starting Tavern desktop backend...
            </div>
        );
    }

    if (!clientState) {
        return null;
    }

    return (
        <trpc.Provider client={clientState.client} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <ChatTimelineProvider>
                    <ChatStartDraftProvider>
                        <TimelineContextProvider>
                            <TrpcEventListeners />
                            {children}
                        </TimelineContextProvider>
                    </ChatStartDraftProvider>
                </ChatTimelineProvider>
            </QueryClientProvider>
        </trpc.Provider>
    );
}
