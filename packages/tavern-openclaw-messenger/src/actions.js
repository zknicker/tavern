import { assertTavernChatId, readChatIdFromTarget } from './config.js';
import { createTavernPluginApi } from './tavern-api.js';

const defaultReadLimit = 20;
const maxDirectoryChats = 500;

export const tavernMessageActions = createTavernMessageActions();
export const tavernAgentPrompt = {
    messageToolHints: () => [
        '- Tavern supports `message` actions `send`, `read`, and `search`.',
        '- Omit `target` for the current Tavern chat; use `chat:<id>` or a resolved chat like `#general` for another chat.',
    ],
};
export const tavernDirectoryAdapter = createTavernDirectoryAdapter();

export function createTavernMessageActions(options = {}) {
    const getApi = options.getApi ?? getDefaultApi;

    return {
        describeMessageTool: () => ({
            actions: ['send', 'read', 'search'],
        }),
        resolveExecutionMode: ({ action }) =>
            action === 'read' || action === 'search' ? 'gateway' : 'local',
        supportsAction: ({ action }) =>
            action === 'send' || action === 'read' || action === 'search',
        async handleAction(ctx) {
            if (ctx.action === 'read') {
                const api = getApi();
                return toolJson({
                    ok: true,
                    messages: await readTavernMessages({
                        api,
                        chatId: await resolveActionChatId(ctx, api),
                        params: ctx.params,
                    }),
                });
            }

            if (ctx.action === 'search') {
                const api = getApi();
                const query = readStringParam(ctx.params, 'query', { required: true });
                return toolJson({
                    ok: true,
                    ...(await api.searchMessages(await resolveActionChatId(ctx, api), {
                        limit: readPositiveIntegerParam(ctx.params, 'limit') ?? defaultReadLimit,
                        query,
                    })),
                });
            }

            return null;
        },
    };
}

export function createTavernDirectoryAdapter(options = {}) {
    const getApi = options.getApi ?? getDefaultApi;

    return {
        async listGroups(params = {}) {
            const query = normalizeChatLookup(params.query);
            const page = await getApi().listChats({ limit: params.limit ?? maxDirectoryChats });

            return page.chats
                .filter((chat) => {
                    if (!query) {
                        return true;
                    }
                    const title = normalizeChatLookup(chat.title);
                    return (
                        chat.id.toLowerCase().includes(query) ||
                        title.includes(query) ||
                        `#${title}`.includes(query)
                    );
                })
                .map((chat, index) => ({
                    kind: 'channel',
                    id: chat.id,
                    name: chat.title ?? chat.id,
                    handle: chat.title ?? undefined,
                    rank: index + 1,
                    raw: {
                        lastMessageSequence: chat.last_message_sequence,
                        pinned: chat.pinned,
                    },
                }));
        },
    };
}

async function readTavernMessages({ api, chatId, params }) {
    const limit = readPositiveIntegerParam(params, 'limit') ?? defaultReadLimit;
    const before = readStringOrNumberParam(params, 'before');
    const after = readStringOrNumberParam(params, 'after');
    const around = readStringOrNumberParam(params, 'around');

    if (around !== null) {
        const aroundSequence = await resolveSequence(api, chatId, around);
        const halfWindow = Math.max(1, Math.floor(limit / 2));
        return (
            await api.listMessages(chatId, {
                afterSequence: Math.max(0, aroundSequence - halfWindow - 1),
                limit,
            })
        ).messages;
    }

    if (before !== null) {
        const beforeSequence = await resolveSequence(api, chatId, before);
        return (
            await api.listMessages(chatId, {
                afterSequence: Math.max(0, beforeSequence - limit - 1),
                beforeSequence,
                limit,
            })
        ).messages;
    }

    if (after !== null) {
        return (
            await api.listMessages(chatId, {
                afterSequence: await resolveSequence(api, chatId, after),
                limit,
            })
        ).messages;
    }

    const chat = await api.getChat(chatId);
    return (
        await api.listMessages(chatId, {
            afterSequence: Math.max(0, chat.last_message_sequence - limit),
            limit,
        })
    ).messages;
}

async function resolveSequence(api, chatId, value) {
    if (typeof value === 'number') {
        return value;
    }

    if (/^\d+$/u.test(value)) {
        return Number(value);
    }

    const message = await api.getMessage(value);
    if (message.chat_id !== chatId) {
        throw new Error(`Message ${value} is not in Tavern chat ${chatId}.`);
    }
    return message.sequence;
}

async function resolveActionChatId(ctx, api) {
    const raw =
        readStringParam(ctx.params, 'to') ??
        readStringParam(ctx.params, 'target') ??
        readStringParam(ctx.params, 'channelId') ??
        normalizeString(ctx.toolContext?.currentChannelId) ??
        normalizeString(ctx.toolContext?.currentGraphChannelId);
    if (!raw) {
        throw new Error('Tavern message action requires a Tavern chat target.');
    }

    const direct = readChatIdFromTarget(raw);
    if (direct.startsWith('cht_')) {
        return assertTavernChatId(direct);
    }

    const lookup = normalizeChatLookup(raw);
    const page = await api.listChats({ limit: maxDirectoryChats });
    const match = page.chats.find((chat) => {
        const title = normalizeChatLookup(chat.title);
        return title === lookup || `#${title}` === normalizeString(raw).toLowerCase();
    });

    if (!match) {
        throw new Error(`Unknown Tavern chat target: ${raw}.`);
    }

    return assertTavernChatId(match.id);
}

function getDefaultApi() {
    return createTavernPluginApi({
        baseUrl: process.env.TAVERN_API_BASE_URL,
    });
}

function readPositiveIntegerParam(params, key) {
    const value = params?.[key] ?? params?.[toSnakeCase(key)];
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function readStringOrNumberParam(params, key) {
    const value = params?.[key] ?? params?.[toSnakeCase(key)];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.floor(value);
    }
    return readStringParam(params, key) ?? null;
}

function readStringParam(params, key, options = {}) {
    const value = params?.[key] ?? params?.[toSnakeCase(key)];
    const text = normalizeString(value);
    if (!text) {
        if (options.required) {
            throw new Error(`${key} is required.`);
        }
        return null;
    }
    return text;
}

function normalizeChatLookup(value) {
    return normalizeString(value).toLowerCase().replace(/^#+/u, '');
}

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function toSnakeCase(value) {
    return value.replace(/[A-Z]/gu, (match) => `_${match.toLowerCase()}`);
}

function toolJson(payload) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(payload, null, 2),
            },
        ],
        details: payload,
    };
}
