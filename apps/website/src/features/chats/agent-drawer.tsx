import { useReducedMotion } from 'framer-motion';
import type * as React from 'react';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Button } from '../../components/ui/button.tsx';
import {
    Drawer,
    DrawerDescription,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../components/ui/drawer.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { Elevated } from '../../components/ui/surface.tsx';
import { Table, TableBody, TableCell, TableRow } from '../../components/ui/table.tsx';
import { useAgentAppearanceLookup } from '../../hooks/agents/use-agent-appearance.ts';
import { useAgentSession, useAgentSessionReset } from '../../hooks/agents/use-agent-session.ts';
import { useModelList } from '../../hooks/models/use-model-list.ts';
import { formatRelativeTime } from '../../lib/format.ts';
import { getModelProviderConfig } from '../../lib/model-provider-config.ts';
import type { AgentSessionOutput, ModelListOutput } from '../../lib/trpc.tsx';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from './agent-face.tsx';
import { ChatComposerContextFullness } from './chat-composer-tools.tsx';
import { normalizeModelId } from './chat-context-fullness.ts';

const faceStyle = { flexShrink: 0, overflow: 'visible' } as const;

/**
 * Agent details for one chat: identity, the seat's current Agent session
 * (model, context, turns, timing), and the New session action. Opened by
 * clicking the agent's avatar, so session actions always name their target —
 * no ambiguity in shared channels. See specs/agent-drawer.md.
 */
export function AgentDrawer({
    agentId,
    agentName,
    chatId,
    onOpenChange,
    open,
}: {
    agentId: string;
    agentName: string;
    chatId: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    return (
        <Drawer onOpenChange={onOpenChange} open={open} position="right">
            <DrawerPopup
                className="w-[min(96vw,26rem)] max-w-[min(96vw,26rem)] overflow-hidden"
                showCloseButton
                variant="inset"
            >
                <AgentDrawerHeader agentId={agentId} agentName={agentName} />
                <DrawerPanel>
                    {open ? <AgentDrawerBody agentId={agentId} chatId={chatId} /> : null}
                </DrawerPanel>
            </DrawerPopup>
        </Drawer>
    );
}

function AgentDrawerHeader({ agentId, agentName }: { agentId: string; agentName: string }) {
    const lookupAppearance = useAgentAppearanceLookup();
    const dark = useResolvedThemeOptional() === 'dark';
    const shouldReduceMotion = useReducedMotion();
    const appearance = lookupAppearance(agentId);

    return (
        <DrawerHeader className="gap-3">
            <div className="flex items-center gap-2.5">
                <div className="flex size-11 shrink-0 items-center justify-center">
                    <AgentFace
                        blinking={!shouldReduceMotion}
                        dark={dark}
                        head={appearance.character}
                        ink={resolveAgentInk(dark, appearance.primaryColor)}
                        size={40}
                        speed={shouldReduceMotion ? 0.35 : 0.78}
                        style={faceStyle}
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <DrawerTitle className="truncate">{agentName}</DrawerTitle>
                    <DrawerDescription>Agent in this chat</DrawerDescription>
                </div>
            </div>
        </DrawerHeader>
    );
}

function AgentDrawerBody({ agentId, chatId }: { agentId: string; chatId: string }) {
    const sessionQuery = useAgentSession({ agentId, chatId });
    const resetSession = useAgentSessionReset();
    const modelList = useModelList();

    return (
        <div className="flex min-w-0 flex-col gap-3 pt-2 pb-2">
            <Elevated className="flex flex-col gap-2 rounded-lg px-3 py-2.5" offset={1}>
                <span className="font-medium text-foreground text-sm">Session</span>
                {sessionQuery.isPending ? (
                    <span className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Spinner className="size-3.5" />
                        Loading session...
                    </span>
                ) : sessionQuery.isError ? (
                    <span className="text-destructive text-sm">
                        Could not load the session: {sessionQuery.error.message}
                    </span>
                ) : (
                    <AgentSessionFacts
                        models={modelList.data?.models ?? []}
                        session={sessionQuery.data.session}
                        stats={sessionQuery.data.stats}
                    />
                )}
            </Elevated>
            <div className="flex flex-col gap-1.5">
                <Button
                    disabled={resetSession.isPending}
                    onClick={() => resetSession.mutate({ agentId, chatId })}
                    variant="secondary"
                >
                    {resetSession.isPending ? <Spinner className="size-3.5" /> : null}
                    New session
                </Button>
                <p className="text-muted-foreground text-xs">
                    Starts fresh context without clearing the chat.
                </p>
                {resetSession.error ? (
                    <p className="text-destructive text-xs">{resetSession.error.message}</p>
                ) : null}
            </div>
            {sessionQuery.data && sessionQuery.data.pastSessions.length > 0 ? (
                <PastSessionList sessions={sessionQuery.data.pastSessions} />
            ) : null}
        </div>
    );
}

function PastSessionList({ sessions }: { sessions: AgentSessionOutput['pastSessions'] }) {
    return (
        <Elevated className="mt-12 flex flex-col gap-1 rounded-lg px-3 pt-2.5 pb-1" offset={1}>
            <span className="font-medium text-foreground text-sm">Past sessions</span>
            <div className="-mx-3">
                <Table>
                    <TableBody className="[&_tr:last-child]:border-0">
                        {sessions.map((session) => (
                            <TableRow key={session.id}>
                                <TableCell className="max-w-0 truncate text-foreground">
                                    {session.effectiveModel.model}
                                    <span className="text-muted-foreground">
                                        {' · '}
                                        {session.turnCount === 1
                                            ? '1 turn'
                                            : `${session.turnCount} turns`}
                                    </span>
                                </TableCell>
                                <TableCell className="w-px text-right text-muted-foreground text-xs">
                                    {formatPastSessionTiming(session)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Elevated>
    );
}

// "ended 2h ago" for archived sessions; stopped ones name the state instead.
function formatPastSessionTiming(session: AgentSessionOutput['pastSessions'][number]) {
    if (session.status === 'stopped') {
        return `stopped ${formatRelativeTime(session.updatedAt)}`;
    }

    return `ended ${formatRelativeTime(session.archivedAt ?? session.updatedAt)}`;
}

function AgentSessionFacts({
    models,
    session,
    stats,
}: {
    models: ModelListOutput['models'];
    session: AgentSessionOutput['session'];
    stats: AgentSessionOutput['stats'];
}) {
    if (!session) {
        return (
            <span className="text-muted-foreground text-sm">
                No session yet. The next message starts one.
            </span>
        );
    }

    const provider = getModelProviderConfig(session.effectiveModel.provider);
    const context = getSessionContext(models, session, stats);
    const facts: [string, React.ReactNode][] = [
        ['Model', `${session.effectiveModel.model} · ${provider.displayName}`],
        ...(context ? [['Context', context] as [string, React.ReactNode]] : []),
        ['Turns', String(stats?.turnCount ?? 0)],
        ...(session.status !== 'active'
            ? [['Status', formatSessionStatus(session.status)] as [string, React.ReactNode]]
            : []),
        ['Started', formatRelativeTime(session.createdAt)],
        ['Last activity', formatRelativeTime(session.updatedAt)],
    ];

    return (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 text-sm">
            {facts.map(([label, value]) => (
                <div className="contents" key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 truncate text-foreground">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

// Context fullness pairs the session's harness-reported token count with the
// model's context window from the model catalog. Partial data degrades to a
// plain token count; no data hides the row.
function getSessionContext(
    models: ModelListOutput['models'],
    session: NonNullable<AgentSessionOutput['session']>,
    stats: AgentSessionOutput['stats']
) {
    const tokenCount = stats?.contextTokens ?? null;

    if (tokenCount === null) {
        return null;
    }

    const contextWindow =
        models.find(
            (candidate) =>
                candidate.provider === session.effectiveModel.provider &&
                normalizeModelId(candidate.modelId) ===
                    normalizeModelId(session.effectiveModel.model)
        )?.contextWindow ?? null;

    if (!contextWindow) {
        return <span>{formatTokens(tokenCount)} tokens</span>;
    }

    return (
        <span className="flex items-center gap-2">
            <ChatComposerContextFullness
                fullness={{
                    contextWindow,
                    percent: Math.min(tokenCount / contextWindow, 1),
                    tokenCount,
                }}
            />
            <span className="text-muted-foreground">
                {formatTokens(tokenCount)} of {formatTokens(contextWindow)}
            </span>
        </span>
    );
}

function formatTokens(value: number) {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 1,
        notation: 'compact',
    }).format(value);
}

function formatSessionStatus(status: 'active' | 'archived' | 'stopped') {
    switch (status) {
        case 'active':
            return 'Active';
        case 'archived':
            return 'Archived';
        case 'stopped':
            return 'Stopped';
    }
}
