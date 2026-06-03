import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAgentDisplayNameToInstructions } from './agent-instructions-preview-drawer.tsx';

test('applyAgentDisplayNameToInstructions reflects the current display name draft', () => {
    const content = [
        '# Tavern Agent Instructions',
        '',
        'You are main, a Tavern-managed agent.',
        '',
        'Saved instructions.',
    ].join('\n');

    assert.equal(
        applyAgentDisplayNameToInstructions(content, 'Blippy'),
        [
            '# Tavern Agent Instructions',
            '',
            'You are Blippy, a Tavern-managed agent.',
            '',
            'Saved instructions.',
        ].join('\n')
    );
});

test('applyAgentDisplayNameToInstructions leaves unrelated content alone', () => {
    const content = '# AGENTS.md\n\nCustom instructions.';

    assert.equal(applyAgentDisplayNameToInstructions(content, 'Blippy'), content);
});
