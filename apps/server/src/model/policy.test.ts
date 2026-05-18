import { expect, test } from 'bun:test';
import { parseAgentRuntimeModelRef } from '@tavern/api';
import { validateRoutingModels } from './policy.ts';

test('validateRoutingModels allows cataloged routing providers', () => {
    expect(() =>
        validateRoutingModels({
            agents: [
                {
                    agentId: 'agent:ops',
                    fallbackModels: [],
                    isOverridden: true,
                    primaryModel: parseAgentRuntimeModelRef('codex/gpt-5.4'),
                    subAgentModel: parseAgentRuntimeModelRef('codex/gpt-5.4'),
                },
            ],
            configuredModels: [
                parseAgentRuntimeModelRef('claude/claude-opus-4-7'),
                parseAgentRuntimeModelRef('codex/gpt-5.4'),
            ],
            defaults: {
                fallbackModels: [parseAgentRuntimeModelRef('codex/gpt-5.4')],
                primaryModel: parseAgentRuntimeModelRef('claude/claude-opus-4-7'),
            },
            defaultsThinkingLevel: null,
            subAgentDefaultModel: parseAgentRuntimeModelRef('codex/gpt-5.4'),
            subAgentThinkingLevel: null,
            updatedAt: null,
        })
    ).not.toThrow();
});

test('validateRoutingModels rejects unsupported routing providers', () => {
    expect(() =>
        validateRoutingModels({
            agents: [],
            configuredModels: [
                parseAgentRuntimeModelRef('claude/claude-opus-4-7'),
                parseAgentRuntimeModelRef('openrouter/anthropic/claude-opus-4.7'),
            ],
            defaults: {
                fallbackModels: [],
                primaryModel: parseAgentRuntimeModelRef('openrouter/anthropic/claude-opus-4.7'),
            },
            defaultsThinkingLevel: null,
            subAgentDefaultModel: null,
            subAgentThinkingLevel: null,
            updatedAt: null,
        })
    ).toThrow(
        'The default chat model must use a provider that Tavern Runtime supports for chat routing.'
    );
});

test('validateRoutingModels rejects routing refs that are not in the catalog', () => {
    expect(() =>
        validateRoutingModels({
            agents: [],
            configuredModels: [parseAgentRuntimeModelRef('claude/claude-opus-4-7')],
            defaults: {
                fallbackModels: [parseAgentRuntimeModelRef('claude/claude-sonnet-4-6')],
                primaryModel: parseAgentRuntimeModelRef('claude/claude-opus-4-7'),
            },
            defaultsThinkingLevel: null,
            subAgentDefaultModel: null,
            subAgentThinkingLevel: null,
            updatedAt: null,
        })
    ).toThrow('A default fallback model must be in the Tavern model catalog.');
});
