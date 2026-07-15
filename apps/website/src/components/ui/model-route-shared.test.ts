import { expect, test } from 'bun:test';
import type { ModelListOutput } from '../../lib/trpc.tsx';
import { buildModelOptions } from './model-route-shared.ts';

function createModelList(): ModelListOutput {
    return {
        agents: [],
        defaultsThinkingLevel: null,
        models: [
            {
                availability: 'configured',
                capability: 'agent',
                contextWindow: null,
                framework: 'tavern',
                id: 'claude/claude-opus-4-7',
                modelId: 'claude-opus-4-7',
                name: 'Claude Opus 4.7',
                provider: 'claude',
                ref: 'claude/claude-opus-4-7',
                reasoning: null,
            },
            {
                availability: 'configured',
                capability: 'agent',
                contextWindow: null,
                framework: 'tavern',
                id: 'openrouter/anthropic/claude-opus-4.7',
                modelId: 'anthropic/claude-opus-4.7',
                name: 'Claude Opus 4.7',
                provider: 'openrouter',
                ref: 'openrouter/anthropic/claude-opus-4.7',
                reasoning: null,
            },
            {
                availability: 'configured',
                capability: 'agent',
                contextWindow: null,
                framework: 'tavern',
                id: 'openai-codex/gpt-5.4',
                modelId: 'gpt-5.4',
                name: 'GPT-5.4',
                provider: 'openai-codex',
                ref: 'openai-codex/gpt-5.4',
                reasoning: null,
            },
        ],
        openRouter: {
            hasApiKey: false,
            updatedAt: null,
        },
        subAgentThinkingLevel: null,
    };
}

test('buildModelOptions only falls back to raw refs when labels would collide', () => {
    const data = createModelList();

    data.models = [
        {
            availability: 'configured',
            capability: 'agent',
            contextWindow: null,
            framework: 'tavern',
            id: 'claude/claude-sonnet-4-6',
            modelId: 'claude-sonnet-4-6',
            name: 'Claude Sonnet 4.6',
            provider: 'claude',
            ref: 'claude/claude-sonnet-4-6',
            reasoning: null,
        },
        {
            availability: 'configured',
            capability: 'agent',
            contextWindow: null,
            framework: 'tavern',
            id: 'openrouter/anthropic/claude-sonnet-4-6',
            modelId: 'anthropic/claude-sonnet-4-6',
            name: 'Claude Sonnet 4.6',
            provider: 'openrouter',
            ref: 'openrouter/anthropic/claude-sonnet-4-6',
            reasoning: null,
        },
    ];

    expect(buildModelOptions(data)).toEqual([
        {
            availability: 'configured',
            label: 'Claude Sonnet 4.6 · claude/claude-sonnet-4-6',
            provider: 'claude',
            value: 'claude/claude-sonnet-4-6',
        },
        {
            availability: 'configured',
            label: 'Claude Sonnet 4.6 · openrouter/anthropic/claude-sonnet-4-6',
            provider: 'openrouter',
            value: 'openrouter/anthropic/claude-sonnet-4-6',
        },
    ]);
});
