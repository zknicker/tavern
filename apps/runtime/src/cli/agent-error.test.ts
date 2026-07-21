import { describe, expect, test } from 'vitest';
import { AgentCliError, renderAgentCliError } from './agent-error.ts';

describe('renderAgentCliError', () => {
    test('renders the canonical line order', () => {
        expect(
            renderAgentCliError(
                new AgentCliError('SEND_FAILED', 'Message was not sent.', {
                    draftSaved: true,
                    nextAction: 'Review the target and retry.',
                })
            )
        ).toBe(
            'Error: Message was not sent.\nCode: SEND_FAILED\nDraft saved: yes\nNext action: Review the target and retry.\n'
        );
    });

    test('omits optional lines', () => {
        expect(renderAgentCliError(new AgentCliError('READ_FAILED', 'Read failed.'))).toBe(
            'Error: Read failed.\nCode: READ_FAILED\n'
        );
    });
});
