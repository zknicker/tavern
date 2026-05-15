import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionLogPageSchema } from '../sessions/contracts.ts';

test('sessionLogPageSchema accepts standard activity entries', () => {
    const page = sessionLogPageSchema.parse({
        entries: [
            {
                accessEvent: {
                    errorCode: null,
                    errorMessage: null,
                    id: 'access-1',
                    occurredAt: '2026-03-25T01:00:00.000Z',
                    status: 'delivered',
                    targetSessionKey: 'agent:main:discord:channel:1',
                    toolName: 'post_message',
                },
                id: 'access-entry-1',
                kind: 'accessEvent',
                timestamp: '2026-03-25T01:00:00.000Z',
            },
        ],
        limit: 10,
        offset: 0,
        total: 1,
    });

    assert.equal(page.entries[0]?.kind, 'accessEvent');
});
