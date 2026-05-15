import { describe, expect, test } from 'bun:test';
import { buildAgentToolPolicy, defaultAgentToolNames } from '../../agents/tool-policy-defaults.ts';
import { enforceAgentToolPolicies } from './enforce-agent-tools.ts';

const agents = [
    {
        id: 'planner',
        name: 'Planner',
    },
];

describe('enforceAgentToolPolicies', () => {
    test('writes default policy for agents without explicit OpenClaw tool policy', () => {
        const config = enforceAgentToolPolicies(
            {
                agents: {
                    list: [
                        {
                            id: 'planner',
                            name: 'Planner',
                            tools: {
                                exec: {
                                    safeBins: ['git'],
                                },
                            },
                        },
                    ],
                },
            },
            agents
        );

        expect(config.agents).toEqual({
            list: [
                {
                    id: 'planner',
                    name: 'Planner',
                    tools: {
                        exec: {
                            safeBins: ['git'],
                        },
                        ...buildAgentToolPolicy(defaultAgentToolNames),
                    },
                },
            ],
        });
    });

    test('preserves existing agent and global tool policies', () => {
        const agentPolicyConfig = {
            agents: {
                list: [
                    {
                        id: 'planner',
                        tools: {
                            allow: ['read'],
                        },
                    },
                ],
            },
        };
        const globalPolicyConfig = {
            tools: {
                profile: 'coding',
            },
        };

        expect(enforceAgentToolPolicies(agentPolicyConfig, agents)).toEqual(agentPolicyConfig);
        expect(enforceAgentToolPolicies(globalPolicyConfig, agents)).toEqual(globalPolicyConfig);
        expect(enforceAgentToolPolicies({}, [])).toEqual({});
    });
});
