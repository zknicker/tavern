import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelListOutput } from '../../../lib/trpc.tsx';
import { listThinkingOptionsForModelChoice, selectModelChoice } from './model-section.tsx';

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

test('selectModelChoice preserves the selected Hermes model ref', () => {
    assert.equal(
        selectModelChoice(models, {
            modelRef: 'openai-codex/gpt-5.5',
            thinkingDefault: null,
        })?.model.ref,
        'openai-codex/gpt-5.5'
    );
});

test('selectModelChoice chooses the first sorted model without a current selection', () => {
    assert.equal(selectModelChoice(models, null)?.model.ref, 'anthropic/claude-opus-4-7');
});

test('listThinkingOptionsForModelChoice includes the Hermes effort enum for any selected model', () => {
    const choice = selectModelChoice(models, {
        modelRef: 'openai-codex/gpt-5.5',
        thinkingDefault: null,
    });
    assert.deepEqual(
        listThinkingOptionsForModelChoice(choice).map((option) => option.value),
        ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'adaptive', 'max']
    );
});

test('listThinkingOptionsForModelChoice returns no overrides without a selected model', () => {
    assert.deepEqual(listThinkingOptionsForModelChoice(null), []);
});
