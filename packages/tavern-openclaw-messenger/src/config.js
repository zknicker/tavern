export const TAVERN_CHANNEL_ID = 'tavern';
export const DEFAULT_ACCOUNT_ID = 'default';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function resolveTavernAccount(_config, accountId = DEFAULT_ACCOUNT_ID) {
    return {
        accountId,
        configured: true,
        enabled: true,
        name: 'Tavern',
        chats: [],
    };
}

export function buildTavernTarget(chatId) {
    return `chat:${assertTavernChatId(readChatIdFromTarget(chatId))}`;
}

export function readChatIdFromTarget(target) {
    return target.startsWith('chat:') ? target.slice('chat:'.length) : target;
}

export function buildTavernPeerId(target) {
    return assertTavernChatId(readChatIdFromTarget(target));
}

export function assertSafeStoreKey(key) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw new Error(`Refusing to persist Tavern chat under unsafe key: ${key}`);
    }
    return key;
}

export function assertTavernChatId(value) {
    const id = typeof value === 'string' ? value.trim() : '';

    if (!uuidPattern.test(id)) {
        throw new Error('Tavern chat id must be a UUID.');
    }

    return id;
}
