import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as runtimeChats from './runtime-chats.ts';
import { updateTavernChatSystemPrompt, updateTavernChatTabAppearance } from './save.ts';

afterEach(() => {
    mock.restore();
});

test('updateTavernChatSystemPrompt stores prompt text for Tavern chats', async () => {
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockResolvedValue({
        chat: {
            platform: 'tavern',
        },
    } as Awaited<ReturnType<typeof runtimeChats.getRuntimeChatRecord>>);
    const updateSystemPrompt = spyOn(
        runtimeChats,
        'updateRuntimeTavernChatSystemPrompt'
    ).mockResolvedValue(undefined);

    const result = await updateTavernChatSystemPrompt({
        chatId: 'cht_1',
        systemPrompt: '  Keep this focused.  ',
    });

    assert.deepEqual(result, {
        chatId: 'cht_1',
        systemPrompt: 'Keep this focused.',
    });
    assert.deepEqual(updateSystemPrompt.mock.calls, [
        [
            {
                chatId: 'cht_1',
                systemPrompt: 'Keep this focused.',
            },
        ],
    ]);
});

test('updateTavernChatTabAppearance stores channel color for Tavern channels', async () => {
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockResolvedValue({
        chat: {
            platform: 'tavern',
            scope: 'channel',
        },
    } as Awaited<ReturnType<typeof runtimeChats.getRuntimeChatRecord>>);
    const updateTabAppearance = spyOn(
        runtimeChats,
        'updateRuntimeTavernChatTabAppearance'
    ).mockResolvedValue(undefined);

    const result = await updateTavernChatTabAppearance({
        chatId: 'cht_1',
        color: '#22c55e',
    });

    assert.deepEqual(result, {
        chatId: 'cht_1',
        tabAppearance: {
            color: '#22c55e',
        },
    });
    assert.deepEqual(updateTabAppearance.mock.calls, [
        [
            {
                chatId: 'cht_1',
                tabAppearance: {
                    color: '#22c55e',
                },
            },
        ],
    ]);
});

test('updateTavernChatTabAppearance rejects Tavern DMs', async () => {
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockResolvedValue({
        chat: {
            platform: 'tavern',
            scope: 'dm',
        },
    } as Awaited<ReturnType<typeof runtimeChats.getRuntimeChatRecord>>);

    await assert.rejects(
        updateTavernChatTabAppearance({
            chatId: 'cht_1',
            color: '#22c55e',
        }),
        /Only Grotto channels/
    );
});

test('updateTavernChatSystemPrompt rejects non-Tavern chats', async () => {
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockResolvedValue({
        chat: {
            platform: 'discord',
        },
    } as Awaited<ReturnType<typeof runtimeChats.getRuntimeChatRecord>>);

    await assert.rejects(
        updateTavernChatSystemPrompt({
            chatId: 'cht_1',
            systemPrompt: 'Nope',
        }),
        /Only Grotto chats/
    );
});
