import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as runtimeChats from './runtime-chats.ts';
import { updateTavernChatSystemPrompt } from './save.ts';

afterEach(() => {
    mock.restore();
});

test('updateTavernChatSystemPrompt stores prompt text only for pinned Tavern chats', async () => {
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockResolvedValue({
        chat: {
            platform: 'tavern',
        },
        isPinned: true,
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

test('updateTavernChatSystemPrompt rejects unpinned chats', async () => {
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockResolvedValue({
        chat: {
            platform: 'tavern',
        },
        isPinned: false,
    } as Awaited<ReturnType<typeof runtimeChats.getRuntimeChatRecord>>);

    await assert.rejects(
        updateTavernChatSystemPrompt({
            chatId: 'cht_1',
            systemPrompt: 'Nope',
        }),
        /Only pinned chats/
    );
});
