import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelListOutput } from '../../../lib/trpc.tsx';
import { listThinkingOptionsForModelChoice, selectModelChoice } from './model-section.tsx';

const models = [
    {
        availability: 'available',
        capability: 'agent',
        contextWindow: 400_000,
        framework: 'agent-engine',
        id: 'codex/gpt-5.5',
        modelId: 'gpt-5.5',
        name: 'GPT-5.5',
        provider: 'codex',
        reasoning: null,
        ref: 'codex/gpt-5.5',
    },
    {
        availability: 'available',
        capability: 'agent',
        contextWindow: 400_000,
        framework: 'agent-engine',
        id: 'codex/gpt-5.4',
        modelId: 'gpt-5.4',
        name: 'GPT-5.4',
        provider: 'codex',
        reasoning: null,
        ref: 'codex/gpt-5.4',
    },
    {
        availability: 'available',
        capability: 'agent',
        contextWindow: 1_000_000,
        framework: 'agent-engine',
        id: 'claude/claude-sonnet-4-6',
        modelId: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        provider: 'claude',
        reasoning: null,
        ref: 'claude/claude-sonnet-4-6',
    },
    {
        availability: 'available',
        capability: 'agent',
        contextWindow: 1_000_000,
        framework: 'agent-engine',
        id: 'claude/claude-opus-4-8',
        modelId: 'claude-opus-4-8',
        name: 'Claude Opus 4.8',
        provider: 'claude',
        reasoning: null,
        ref: 'claude/claude-opus-4-8',
    },
] satisfies ModelListOutput['models'];

test('selectModelChoice preserves the selected agent model ref', () => {
    assert.equal(
        selectModelChoice(models, {
            modelRef: 'codex/gpt-5.5',
            thinkingDefault: null,
        })?.model.ref,
        'codex/gpt-5.5'
    );
});

test('selectModelChoice treats Codex and Claude entries as model choices, not provider placeholders', () => {
    assert.equal(
        models.some((model) => model.ref === 'codex/oauth' || model.ref === 'claude/oauth'),
        false
    );
    assert.deepEqual(
        models
            .filter((model) => model.provider === 'codex' || model.provider === 'claude')
            .map((model) => model.ref),
        ['codex/gpt-5.5', 'codex/gpt-5.4', 'claude/claude-sonnet-4-6', 'claude/claude-opus-4-8']
    );
});

test('selectModelChoice chooses the first sorted model without a current selection', () => {
    assert.equal(selectModelChoice(models, null)?.model.ref, 'claude/claude-opus-4-8');
});

test('listThinkingOptionsForModelChoice includes the runtime effort enum for any selected model', () => {
    const choice = selectModelChoice(models, {
        modelRef: 'codex/gpt-5.5',
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
