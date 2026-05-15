export interface ChatIdentity {
    externalId: string | null;
    id: string;
    target: string | null;
    type: string;
}

export interface ChatActorPresentation {
    actorId: string;
    actorType: 'agent' | 'participant';
    name: string;
    profileId?: string | null;
}

function getExternalIdFromTarget(target: string | null) {
    if (!target) {
        return null;
    }

    const [, rawExternalId = ''] = target.split(':', 2);
    const externalId = rawExternalId.trim();

    return externalId.length > 0 ? externalId : null;
}

export function buildChatId(identity: {
    externalId: string | null;
    target: string | null;
    type: string;
}) {
    const targetOrExternalId = identity.target ?? identity.externalId;

    if (!targetOrExternalId) {
        return null;
    }

    return `${identity.type}:${targetOrExternalId}`;
}

export function resolveChatIdentityFromId(chatId: string): ChatIdentity | null {
    const separatorIndex = chatId.indexOf(':');

    if (separatorIndex <= 0 || separatorIndex >= chatId.length - 1) {
        return null;
    }

    const type = chatId.slice(0, separatorIndex).trim();
    const target = chatId.slice(separatorIndex + 1).trim();

    if (!(type && target)) {
        return null;
    }

    return {
        externalId: getExternalIdFromTarget(target) ?? target,
        id: chatId,
        target,
        type,
    };
}

export function compareChatActors(left: ChatActorPresentation, right: ChatActorPresentation) {
    const leftIsProfile = Boolean(left.profileId);
    const rightIsProfile = Boolean(right.profileId);

    if (leftIsProfile !== rightIsProfile) {
        return leftIsProfile ? -1 : 1;
    }

    if (left.actorType !== right.actorType) {
        return left.actorType === 'participant' ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
}
