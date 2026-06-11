import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelListOutput } from '../../../lib/trpc.tsx';
import {
    findModelByRef,
    findSubagentModelRef,
    listSubagentModelChoices,
    subagentEffortFromSelection,
    subagentModelRefFromSelection,
} from './subagent-rows.tsx';

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

test('subagentModelRefFromSelection maps the inherit sentinel to null', () => {
    assert.equal(subagentModelRefFromSelection('__inherit__'), null);
});

test('subagentModelRefFromSelection keeps explicit model refs', () => {
    assert.equal(
        subagentModelRefFromSelection('anthropic/claude-opus-4-7'),
        'anthropic/claude-opus-4-7'
    );
});

test('subagentEffortFromSelection maps the inherit sentinel to null', () => {
    assert.equal(subagentEffortFromSelection('__inherit__'), null);
});

test('subagentEffortFromSelection keeps known effort values', () => {
    assert.equal(subagentEffortFromSelection('xhigh'), 'xhigh');
});

test('subagentEffortFromSelection rejects unknown values', () => {
    assert.equal(subagentEffortFromSelection('turbo'), null);
});

test('findSubagentModelRef matches the entry by provider and model id', () => {
    assert.equal(
        findSubagentModelRef(models, { model: 'claude-opus-4-7', provider: 'anthropic' }),
        'anthropic/claude-opus-4-7'
    );
});

test('findSubagentModelRef returns null without an entry or a match', () => {
    assert.equal(findSubagentModelRef(models, null), null);
    assert.equal(findSubagentModelRef(models, { model: 'unknown', provider: 'anthropic' }), null);
});

test('findModelByRef resolves the model for an explicit ref', () => {
    assert.equal(findModelByRef(models, 'openai-codex/gpt-5.5')?.modelId, 'gpt-5.5');
    assert.equal(findModelByRef(models, null), null);
});

test('listSubagentModelChoices sorts models by name then provider', () => {
    assert.deepEqual(
        listSubagentModelChoices(models).map((model) => model.ref),
        ['anthropic/claude-opus-4-7', 'anthropic/claude-sonnet-4-6', 'openai-codex/gpt-5.5']
    );
});
