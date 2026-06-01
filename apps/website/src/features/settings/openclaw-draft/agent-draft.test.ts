import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentListOutput, ModelListOutput } from '../../../lib/trpc.tsx';
import {
    readOpenClawAgentConfigEntry,
    readOpenClawAgentDraftConfig,
    writeOpenClawAgentDraftConfig,
} from './agent-draft.ts';
import type { AgentSettingsDraft } from './types.ts';

test('readOpenClawAgentConfigEntry returns the matching agent entry', () => {
    const entry = {
        id: 'debug-agent',
        model: { fallbacks: [], primary: 'openai/gpt-5.5' },
        models: {
            'openai/gpt-5.5': {
                agentRuntime: { id: 'codex' },
            },
        },
        name: 'Debug Agent',
    };

    assert.deepEqual(
        readOpenClawAgentConfigEntry(
            {
                agents: {
                    list: [{ id: 'other-agent' }, entry],
                },
            },
            'debug-agent'
        ),
        entry
    );
});

test('readOpenClawAgentConfigEntry returns null when the agent is not in the draft', () => {
    assert.equal(
        readOpenClawAgentConfigEntry(
            {
                agents: {
                    list: [{ id: 'other-agent' }],
                },
            },
            'missing-agent'
        ),
        null
    );
});

test('readOpenClawAgentDraftConfig preserves an explicit harness route', () => {
    const draft = readOpenClawAgentDraftConfig({
        agent: { id: 'main', name: 'Main' } as AgentListOutput['agents'][number],
        baseline: {
            model: {
                harness: 'codex',
                modelId: 'codex/gpt-5.5',
                openClawModelNameId: 'codex:openai/gpt-5.5',
                thinkingDefault: null,
            },
            profile: {
                defaultPrimaryColor: '#7c5cff',
                displayName: 'Main',
                primaryColor: '#7c5cff',
            },
        },
        config: {
            agents: {
                list: [
                    {
                        id: 'main',
                        model: { fallbacks: [], primary: 'openai/gpt-5.5' },
                        models: {
                            'openai/gpt-5.5': {
                                agentRuntime: { id: 'pi' },
                            },
                        },
                    },
                ],
            },
        },
        modelOptions: modelOptionsFixture,
    });

    assert.equal(draft.model?.harness, 'pi');
    assert.equal(draft.model?.openClawModelNameId, 'pi:openai/gpt-5.5');
});

test('writeOpenClawAgentDraftConfig stores model selection without forcing a harness', () => {
    const config = writeOpenClawAgentDraftConfig(
        {
            agents: {
                list: [
                    {
                        id: 'main',
                        model: { fallbacks: [], primary: 'openai/gpt-5.5' },
                        models: {
                            'openai/gpt-5.5': {
                                agentRuntime: { id: 'pi' },
                                params: { temperature: 0.2 },
                            },
                        },
                    },
                ],
            },
        },
        {
            agent: { id: 'main', name: 'Main' } as AgentListOutput['agents'][number],
            draft: {
                model: {
                    harness: 'codex',
                    modelId: 'codex/gpt-5.5',
                    openClawModelNameId: 'codex:openai/gpt-5.5',
                    thinkingDefault: null,
                },
                profile: {
                    defaultPrimaryColor: '#7c5cff',
                    displayName: 'Main',
                    primaryColor: '#7c5cff',
                },
            } satisfies AgentSettingsDraft,
            modelOptions: modelOptionsFixture,
        }
    );

    assert.deepEqual(readOpenClawAgentConfigEntry(config, 'main'), {
        id: 'main',
        model: { fallbacks: [], primary: 'openai/gpt-5.5' },
        models: {
            'openai/gpt-5.5': {
                params: { temperature: 0.2 },
            },
        },
        name: 'Main',
    });
});

test('writeOpenClawAgentDraftConfig preserves explicit non-preferred harness routes', () => {
    const config = writeOpenClawAgentDraftConfig(
        {
            agents: {
                list: [
                    {
                        id: 'main',
                        model: { fallbacks: [], primary: 'openai/gpt-5.5' },
                        models: {
                            'openai/gpt-5.5': {
                                params: { temperature: 0.2 },
                            },
                        },
                    },
                ],
            },
        },
        {
            agent: { id: 'main', name: 'Main' } as AgentListOutput['agents'][number],
            draft: {
                model: {
                    harness: 'pi',
                    modelId: 'codex/gpt-5.5',
                    openClawModelNameId: 'pi:openai/gpt-5.5',
                    thinkingDefault: null,
                },
                profile: {
                    defaultPrimaryColor: '#7c5cff',
                    displayName: 'Main',
                    primaryColor: '#7c5cff',
                },
            } satisfies AgentSettingsDraft,
            modelOptions: modelOptionsFixture,
        }
    );

    assert.deepEqual(readOpenClawAgentConfigEntry(config, 'main'), {
        id: 'main',
        model: { fallbacks: [], primary: 'openai/gpt-5.5' },
        models: {
            'openai/gpt-5.5': {
                agentRuntime: { id: 'pi' },
                params: { temperature: 0.2 },
            },
        },
        name: 'Main',
    });
    assert.equal(
        readOpenClawAgentDraftConfig({
            agent: { id: 'main', name: 'Main' } as AgentListOutput['agents'][number],
            baseline: {
                model: null,
                profile: {
                    defaultPrimaryColor: '#7c5cff',
                    displayName: 'Main',
                    primaryColor: '#7c5cff',
                },
            },
            config,
            modelOptions: modelOptionsFixture,
        }).model?.openClawModelNameId,
        'pi:openai/gpt-5.5'
    );
});

const modelOptionsFixture = [
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
                harness: 'codex',
                id: 'codex:openai/gpt-5.5',
                isPreferred: true,
                label: 'openai/gpt-5.5',
                model: 'gpt-5.5',
                provider: 'openai',
            },
            {
                available: true,
                harness: 'pi',
                id: 'pi:openai/gpt-5.5',
                isPreferred: false,
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
] satisfies ModelListOutput['models'];
