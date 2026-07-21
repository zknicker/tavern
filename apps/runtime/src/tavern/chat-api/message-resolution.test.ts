import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeAgentApiTestDb, initAgentApiTestDb } from '../agent-api-test-helper.ts';
import { createChat, createMessage } from './index.ts';
import { AmbiguousMessageIdError, resolveMessageId } from './message-resolution.ts';

describe('message id resolution', () => {
    let root: string;
    beforeEach(() => {
        root = initAgentApiTestDb('grotto-message-ids-');
        createChat({ id: 'cht_general', kind: 'channel', title: 'general' });
    });
    afterEach(async () => await closeAgentApiTestDb(root));

    it('resolves full ids, unique short ids, and legacy ids only in full', () => {
        seed('msg_a1b2c3d4000000000000000000000000');
        seed('msg_legacy_value');
        expect(resolveMessageId('a1b2c3d4')?.id).toBe('msg_a1b2c3d4000000000000000000000000');
        expect(resolveMessageId('msg_a1b2c3d4000000000000000000000000')?.id).toBe(
            'msg_a1b2c3d4000000000000000000000000'
        );
        expect(resolveMessageId('legacy_v')).toBeNull();
        expect(resolveMessageId('msg_legacy_value')?.id).toBe('msg_legacy_value');
    });

    it('fails closed on an ambiguous short id', () => {
        seed('msg_deadbeef000000000000000000000000');
        seed('msg_deadbeefffffffffffffffffffffffff');
        expect(() => resolveMessageId('deadbeef')).toThrow(AmbiguousMessageIdError);
    });
});

function seed(id: string) {
    createMessage('cht_general', { author_id: 'usr_tavern', content: id, id, role: 'user' });
}
