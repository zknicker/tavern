import assert from 'node:assert/strict';
import test from 'node:test';
import { readOpenClawAgentConfigEntry } from './agent-draft.ts';

test('readOpenClawAgentConfigEntry returns the matching agent entry', () => {
    const entry = {
        id: 'debug-agent',
        model: { fallbacks: [], primary: 'openai/gpt-5.5' },
        models: {
            'openai/gpt-5.5': {
                agentRuntime: { id: 'codex' },
            },
        },
        name: 'Debug Agent',
    };

    assert.deepEqual(
        readOpenClawAgentConfigEntry(
            {
                agents: {
                    list: [{ id: 'other-agent' }, entry],
                },
            },
            'debug-agent'
        ),
        entry
    );
});

test('readOpenClawAgentConfigEntry returns null when the agent is not in the draft', () => {
    assert.equal(
        readOpenClawAgentConfigEntry(
            {
                agents: {
                    list: [{ id: 'other-agent' }],
                },
            },
            'missing-agent'
        ),
        null
    );
});
