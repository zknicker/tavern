import type { ChatActorPresentation } from './shared.ts';

export const chatConversationKinds = ['channel', 'direct', 'group', 'topic'] as const;
export type ChatConversationKind = (typeof chatConversationKinds)[number];

const configuredScopeToConversationKind = new Map<string, ChatConversationKind>([
    ['channel', 'channel'],
    ['dm', 'direct'],
    ['group', 'group'],
    ['guild-channel', 'channel'],
    ['topic', 'topic'],
]);

const supportedChatScopes = new Set(['channel', 'dm', 'group', 'topic']);

type ChatScope = 'channel' | 'dm' | 'group' | 'topic';

function countActors(participants: Pick<ChatActorPresentation, 'actorType'>[]) {
    let agentCount = 0;
    let participantCount = 0;

    for (const participant of participants) {
        if (participant.actorType === 'agent') {
            agentCount += 1;
            continue;
        }

        participantCount += 1;
    }

    return { agentCount, participantCount };
}

function resolveDiscordObservedConversationKind(input: {
    configured: boolean;
    participants: Pick<ChatActorPresentation, 'actorType'>[];
    target: string | null;
}) {
    if (input.configured || resolveConversationKindFromTarget(input.target) !== 'channel') {
        return null;
    }

    const { agentCount, participantCount } = countActors(input.participants);

    return agentCount === 1 && participantCount === 1 ? 'direct' : null;
}

export function resolveConversationKindFromConfiguredScope(
    scope: string | null
): ChatConversationKind | null {
    if (!scope) {
        return null;
    }

    return configuredScopeToConversationKind.get(scope.trim()) ?? null;
}

export function resolveChatScope(target: string | null): ChatScope | null {
    if (!target) {
        return null;
    }

    const [scope = ''] = target.split(':', 1);

    return supportedChatScopes.has(scope) ? (scope as ChatScope) : null;
}

export function resolveConversationKindFromTarget(
    target: string | null
): ChatConversationKind | null {
    const scope = resolveChatScope(target);

    switch (scope) {
        case 'channel':
            return 'channel';
        case 'dm':
            return 'direct';
        case 'group':
            return 'group';
        case 'topic':
            return 'topic';
        default:
            return null;
    }
}

export function resolveObservedConversationKind(input: {
    configured: boolean;
    participants: Pick<ChatActorPresentation, 'actorType'>[];
    target: string | null;
    type: string;
}) {
    const explicitKind = resolveConversationKindFromTarget(input.target);

    if (explicitKind && explicitKind !== 'channel') {
        return explicitKind;
    }

    if (input.type === 'discord') {
        return (
            resolveDiscordObservedConversationKind({
                configured: input.configured,
                participants: input.participants,
                target: input.target,
            }) ??
            explicitKind ??
            'channel'
        );
    }

    return explicitKind ?? 'channel';
}
