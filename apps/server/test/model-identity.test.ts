import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeModelIdentity } from '../src/model/identity.ts';

test('normalizeModelIdentity keeps explicit provider and trims path-like model values', () => {
    const result = normalizeModelIdentity({
        model: 'openrouter/anthropic/claude-3.7-sonnet',
        provider: 'openrouter',
    });

    assert.deepEqual(result, {
        label: 'claude-3.7-sonnet',
        model: 'anthropic/claude-3.7-sonnet',
        provider: 'openrouter',
    });
});

test('normalizeModelIdentity keeps the provider-native model id when provider is explicit', () => {
    const result = normalizeModelIdentity({
        model: 'claude/claude-sonnet-4-6',
        provider: 'claude',
    });

    assert.deepEqual(result, {
        label: 'claude-sonnet-4-6',
        model: 'claude-sonnet-4-6',
        provider: 'claude',
    });
});

test('normalizeModelIdentity rejects partial model tuples', () => {
    assert.throws(
        () =>
            normalizeModelIdentity({
                model: 'claude-3.7-sonnet',
                provider: null,
            }),
        /requires a provider/
    );
    assert.throws(
        () =>
            normalizeModelIdentity({
                model: null,
                provider: 'claude',
            }),
        /requires a model/
    );
});

test('normalizeModelIdentity returns undefined when no model identity exists', () => {
    assert.equal(normalizeModelIdentity({ model: null, provider: null }), undefined);
});
