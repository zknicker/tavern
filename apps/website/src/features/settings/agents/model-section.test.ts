import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelListOutput } from '../../../lib/trpc.tsx';
import { listThinkingOptionsForModelChoice, selectModelChoice } from './model-section.tsx';

const models = [
    {
        availability: 'available',
        contextWindow: 400_000,
        framework: 'tavern',
        id: 'codex/gpt-5.5',
        modelId: 'gpt-5.5',
        name: 'GPT-5.5',
        openClawNames: [
            {
                available: true,
                harness: 'pi',
                id: 'pi:openai/gpt-5.5',
                isPreferred: false,
                label: 'openai/gpt-5.5',
                model: 'gpt-5.5',
                provider: 'openai',
            },
            {
                available: true,
                harness: 'codex',
                id: 'codex:openai/gpt-5.5',
                isPreferred: true,
                label: 'openai/gpt-5.5',
                model: 'gpt-5.5',
                provider: 'openai',
            },
        ],
        provider: 'codex',
        reasoning: null,
        ref: 'codex/gpt-5.5',
        supportsChatRouting: true,
    },
    {
        availability: 'available',
        contextWindow: 1_000_000,
        framework: 'tavern',
        id: 'claude/claude-sonnet-4-6',
        modelId: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        openClawNames: [
            {
                available: true,
                harness: 'pi',
                id: 'pi:anthropic/claude-sonnet-4-6',
                isPreferred: true,
                label: 'anthropic/claude-sonnet-4-6',
                model: 'claude-sonnet-4-6',
                provider: 'anthropic',
            },
        ],
        provider: 'claude',
        reasoning: null,
        ref: 'claude/claude-sonnet-4-6',
        supportsChatRouting: true,
    },
    {
        availability: 'available',
        contextWindow: 1_000_000,
        framework: 'tavern',
        id: 'claude/claude-opus-4-7',
        modelId: 'claude-opus-4-7',
        name: 'Claude Opus 4.7',
        openClawNames: [
            {
                available: true,
                harness: 'pi',
                id: 'pi:anthropic/claude-opus-4-7',
                isPreferred: false,
                label: 'anthropic/claude-opus-4-7',
                model: 'claude-opus-4-7',
                provider: 'anthropic',
            },
        ],
        provider: 'claude',
        reasoning: null,
        ref: 'claude/claude-opus-4-7',
        supportsChatRouting: true,
    },
] satisfies ModelListOutput['models'];

test('selectModelChoice preserves the selected non-preferred route', () => {
    assert.equal(
        selectModelChoice(models, {
            harness: 'pi',
            modelId: 'codex/gpt-5.5',
            openClawModelNameId: 'pi:openai/gpt-5.5',
            thinkingDefault: null,
        })?.name.id,
        'pi:openai/gpt-5.5'
    );
});

test('selectModelChoice chooses the first preferred model without a current selection', () => {
    assert.equal(selectModelChoice(models, null)?.name.id, 'pi:anthropic/claude-opus-4-7');
});

test('listThinkingOptionsForModelChoice includes xhigh for Codex GPT-5.5', () => {
    const choice = selectModelChoice(models, {
        harness: 'codex',
        modelId: 'codex/gpt-5.5',
        openClawModelNameId: 'codex:openai/gpt-5.5',
        thinkingDefault: null,
    });
    assert.deepEqual(
        listThinkingOptionsForModelChoice(choice).map((option) => option.value),
        ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']
    );
});

test('listThinkingOptionsForModelChoice includes adaptive for Claude Sonnet 4.6', () => {
    const choice = selectModelChoice(models, {
        harness: 'pi',
        modelId: 'claude/claude-sonnet-4-6',
        openClawModelNameId: 'pi:anthropic/claude-sonnet-4-6',
        thinkingDefault: null,
    });

    assert.deepEqual(
        listThinkingOptionsForModelChoice(choice).map((option) => option.value),
        ['off', 'minimal', 'low', 'medium', 'high', 'adaptive']
    );
});

test('listThinkingOptionsForModelChoice includes maximum options for Claude Opus 4.7', () => {
    const choice = selectModelChoice(models, {
        harness: 'pi',
        modelId: 'claude/claude-opus-4-7',
        openClawModelNameId: 'pi:anthropic/claude-opus-4-7',
        thinkingDefault: null,
    });

    assert.deepEqual(
        listThinkingOptionsForModelChoice(choice).map((option) => option.value),
        ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'adaptive', 'max']
    );
});
