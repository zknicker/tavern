import type React from 'react';
import { RelativeTime } from '../../../components/time/relative-time.tsx';
import { SettingsValue } from '../../../components/ui/settings-row.tsx';
import { getModelProviderConfig } from '../../../lib/model-provider-config.ts';
import type { AgentSessionOutput, ModelListOutput } from '../../../lib/trpc.tsx';
import { ChatComposerContextFullness } from '../../chats/chat-composer-tools.tsx';
import { normalizeModelId } from '../../chats/chat-context-fullness.ts';

export function AgentSessionFacts({
    models,
    session,
    stats,
}: {
    models: ModelListOutput['models'];
    session: AgentSessionOutput['session'];
    stats: AgentSessionOutput['stats'];
}) {
    if (!session) {
        return <SettingsValue>No session yet. The next message starts one.</SettingsValue>;
    }

    const provider = getModelProviderConfig(session.effectiveModel.provider);
    const context = getSessionContext(models, session, stats);
    const contextFacts: [string, React.ReactNode][] = context ? [['Context', context]] : [];
    const facts: [string, React.ReactNode][] = [
        ['Model', `${session.effectiveModel.model} · ${provider.displayName}`],
        ['Status', formatSessionStatus(session.status)],
        ...contextFacts,
        ['Turns', String(stats?.turnCount ?? 0)],
        ['Started', <RelativeTime key="started" value={session.createdAt} />],
        ['Last activity', <RelativeTime key="activity" value={session.updatedAt} />],
    ];

    return (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            {facts.map(([label, value]) => (
                <div className="contents" key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 truncate text-foreground">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

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

export function AgentPastSessions({
    pastSessions,
}: {
    pastSessions: AgentSessionOutput['pastSessions'];
}) {
    if (pastSessions.length === 0) {
        return null;
    }

    return (
        <ul className="grid gap-1 text-sm">
            {pastSessions.map((entry) => (
                <li className="flex min-w-0 items-baseline gap-2" key={entry.id}>
                    <span className="min-w-0 truncate text-foreground">
                        {entry.effectiveModel.model}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                        {entry.turnCount} {entry.turnCount === 1 ? 'turn' : 'turns'} ·{' '}
                        {entry.status === 'stopped' ? 'stopped' : 'ended'}{' '}
                        <RelativeTime value={entry.updatedAt} />
                    </span>
                </li>
            ))}
        </ul>
    );
}

function formatTokens(value: number) {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 1,
        notation: 'compact',
    }).format(value);
}

function formatSessionStatus(status: 'active' | 'archived' | 'stopped') {
    return status.charAt(0).toUpperCase() + status.slice(1);
}
