import { truncate } from '../../lib/format.ts';
import type { ChatLogOutput, SessionHistoryOutput } from '../../lib/trpc.tsx';

type ThreadMessage =
    | Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'message' }>['message']
    | Extract<SessionHistoryOutput['rows'][number], { kind: 'message' }>['message'];

const maxModelBadgeLength = 22;
const sessionLabelLength = 6;

function isModelInfo(value: unknown): value is {
    label: string;
    provider: string;
} {
    if (!(value && typeof value === 'object')) {
        return false;
    }

    return (
        'label' in value &&
        typeof value.label === 'string' &&
        'provider' in value &&
        typeof value.provider === 'string'
    );
}

function getModelBadgeLabel(model: string) {
    const trimmedModel = model.trim();

    if (trimmedModel.length === 0) {
        return null;
    }

    const slashCandidate = trimmedModel.split('/').at(-1) ?? trimmedModel;
    const colonCandidate = slashCandidate.split(':').at(-1) ?? slashCandidate;
    return truncate(colonCandidate, maxModelBadgeLength);
}

function getSessionBadgeValue(
    message: Pick<ThreadMessage, 'sourceSessionId' | 'sourceSessionKey'>
) {
    const sourceSessionId = message.sourceSessionId?.trim();

    if (sourceSessionId) {
        return sourceSessionId;
    }

    const sourceSessionKey = message.sourceSessionKey.trim();
    return sourceSessionKey.length > 0 ? sourceSessionKey : null;
}

export function getMessageModelContext(message: Pick<ThreadMessage, 'metadata'>) {
    const fullLabel =
        typeof message.metadata?.model === 'string' && message.metadata.model.trim().length > 0
            ? message.metadata.model.trim()
            : isModelInfo(message.metadata?.modelInfo)
              ? message.metadata.modelInfo.label.trim()
              : null;

    if (!fullLabel) {
        return null;
    }

    const badgeLabel = getModelBadgeLabel(fullLabel);

    if (!badgeLabel) {
        return null;
    }

    return {
        badgeLabel,
        fullLabel,
    };
}

export function getMessageProviderContext(message: Pick<ThreadMessage, 'metadata'>) {
    const rawProvider = isModelInfo(message.metadata?.modelInfo)
        ? message.metadata.modelInfo.provider
        : message.metadata?.provider;

    if (typeof rawProvider !== 'string' || rawProvider.trim().length === 0) {
        return null;
    }

    return {
        label: rawProvider.trim(),
    };
}

export function getMessageTokenContext(message: Pick<ThreadMessage, 'metadata'>) {
    const usage = readUsageRecord(message.metadata?.usage);
    const inputTokens =
        readTokenCount(message.metadata?.inputTokens) ?? readTokenCount(usage?.input);
    const cacheReadTokens =
        readTokenCount(message.metadata?.cacheReadTokens) ?? readTokenCount(usage?.cacheRead);
    const totalTokens =
        readTokenCount(message.metadata?.totalTokens) ??
        readTokenCount(usage?.total) ??
        sumTokenCounts([
            inputTokens,
            cacheReadTokens,
            readTokenCount(message.metadata?.outputTokens) ?? readTokenCount(usage?.output),
            readTokenCount(message.metadata?.cacheWriteTokens) ?? readTokenCount(usage?.cacheWrite),
        ]);

    const stats = [
        buildTokenStat('in', 'Input tokens', inputTokens),
        buildTokenStat('cached', 'Cache read tokens', cacheReadTokens),
        buildTokenStat('total', 'Total tokens', totalTokens),
    ].filter((stat): stat is TokenStat => stat !== null);

    return stats.length > 0 ? stats : null;
}

export function getMessageSessionContext(
    message: Pick<ThreadMessage, 'sourceSessionId' | 'sourceSessionKey'>
) {
    const rawValue = getSessionBadgeValue(message);

    if (!rawValue) {
        return null;
    }

    const badgeSuffix =
        rawValue.length > sessionLabelLength ? rawValue.slice(-sessionLabelLength) : rawValue;

    return {
        badgeLabel: `session ${badgeSuffix}`,
        fullLabel: rawValue,
        sessionKey: message.sourceSessionKey,
    };
}

interface TokenStat {
    label: string;
    title: string;
    value: string;
}

function buildTokenStat(label: string, title: string, tokens: number | null): TokenStat | null {
    if (!tokens) {
        return null;
    }

    return {
        label,
        title: `${title}: ${tokens.toLocaleString()}`,
        value: formatTokenCount(tokens),
    };
}

function readUsageRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function readTokenCount(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function sumTokenCounts(values: Array<number | null>): number | null {
    const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return total > 0 ? total : null;
}

function formatTokenCount(tokens: number) {
    if (tokens < 1000) {
        return tokens.toLocaleString();
    }

    const compact = tokens / 1000;
    const maximumFractionDigits = compact < 10 ? 1 : 0;
    return `${compact.toLocaleString(undefined, { maximumFractionDigits })}k`;
}
