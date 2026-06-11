import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAgentGlyph } from './use-agent-avatar-directory.ts';

test('resolveAgentGlyph prefers the stored avatar over name initials', () => {
    assert.equal(resolveAgentGlyph({ avatar: 'HX', name: 'Tavern Hermes' }), 'HX');
});

test('resolveAgentGlyph falls back to initials when the avatar is whitespace', () => {
    assert.equal(resolveAgentGlyph({ avatar: '   ', name: 'Tavern Hermes' }), 'TH');
});

test('resolveAgentGlyph falls back to initials when the avatar is null', () => {
    assert.equal(resolveAgentGlyph({ avatar: null, name: 'Tavern Hermes' }), 'TH');
});

test('resolveAgentGlyph passes emoji avatars through untouched', () => {
    assert.equal(resolveAgentGlyph({ avatar: '🦉', name: 'Tavern Hermes' }), '🦉');
});
