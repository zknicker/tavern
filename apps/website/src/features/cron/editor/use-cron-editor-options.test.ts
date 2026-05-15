import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeliveryChatOptions } from './use-cron-editor-options.ts';

test('buildDeliveryChatOptions preserves the current persisted chat when it is missing', () => {
    const options = buildDeliveryChatOptions(
        [
            {
                label: '#general',
                chatId: 'discord:channel:111',
                platform: 'discord',
            },
        ],
        'slack:channel:C222'
    );

    assert.deepEqual(options, [
        {
            label: 'slack:channel:C222',
            value: 'slack:channel:C222',
        },
        {
            label: '#general',
            value: 'discord:channel:111',
        },
    ]);
});
