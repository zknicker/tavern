import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelListOutput } from '../../../lib/trpc.tsx';
import {
    appendFallback,
    listFallbackChoices,
    removeFallbackAt,
} from './fallback-models-editor.tsx';

const models = [
    {
        availability: 'available',
        contextWindow: 400_000,
        framework: 'hermes',
        id: 'openai-codex/gpt-5.5',
        modelId: 'gpt-5.5',
        name: 'GPT-5.5',
        provider: 'openai-codex',
        reasoning: null,
        ref: 'openai-codex/gpt-5.5',
        supportsChatRouting: true,
    },
    {
        availability: 'available',
        contextWindow: 1_000_000,
        framework: 'hermes',
        id: 'anthropic/claude-sonnet-4-6',
        modelId: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        provider: 'anthropic',
        reasoning: null,
        ref: 'anthropic/claude-sonnet-4-6',
        supportsChatRouting: true,
    },
    {
        availability: 'available',
        contextWindow: 1_000_000,
        framework: 'hermes',
        id: 'anthropic/claude-opus-4-7',
        modelId: 'claude-opus-4-7',
        name: 'Claude Opus 4.7',
        provider: 'anthropic',
        reasoning: null,
        ref: 'anthropic/claude-opus-4-7',
        supportsChatRouting: true,
    },
] satisfies ModelListOutput['models'];

test('appendFallback adds the entry to the end of the chain', () => {
    const next = appendFallback([{ model: 'claude-opus-4-7', provider: 'anthropic' }], {
        model: 'gpt-5.5',
        provider: 'openai-codex',
    });

    assert.deepEqual(next, [
        { model: 'claude-opus-4-7', provider: 'anthropic' },
        { model: 'gpt-5.5', provider: 'openai-codex' },
    ]);
});

test('removeFallbackAt drops only the entry at the given position', () => {
    const next = removeFallbackAt(
        [
            { model: 'claude-opus-4-7', provider: 'anthropic' },
            { model: 'gpt-5.5', provider: 'openai-codex' },
        ],
        0
    );

    assert.deepEqual(next, [{ model: 'gpt-5.5', provider: 'openai-codex' }]);
});

test('listFallbackChoices excludes the primary model and already-chosen fallbacks', () => {
    const choices = listFallbackChoices({
        fallbackModels: [{ model: 'claude-opus-4-7', provider: 'anthropic' }],
        models,
        primaryModelRef: 'openai-codex/gpt-5.5',
    });

    assert.deepEqual(
        choices.map((choice) => choice.ref),
        ['anthropic/claude-sonnet-4-6']
    );
});

test('listFallbackChoices sorts the remaining models by name', () => {
    const choices = listFallbackChoices({
        fallbackModels: [],
        models,
        primaryModelRef: null,
    });

    assert.deepEqual(
        choices.map((choice) => choice.ref),
        ['anthropic/claude-opus-4-7', 'anthropic/claude-sonnet-4-6', 'openai-codex/gpt-5.5']
    );
});
