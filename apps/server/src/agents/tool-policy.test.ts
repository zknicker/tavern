import assert from 'node:assert/strict';
import test from 'node:test';
import { writeAgentTools } from './tool-policy.ts';

test('writeAgentTools converts profiles to explicit allowlists', () => {
    const config = {
        agents: {
            list: [
                {
                    id: 'planner',
                    tools: {
                        exec: {
                            security: 'allowlist',
                        },
                        profile: 'coding',
                        alsoAllow: ['browser'],
                    },
                },
            ],
        },
    };

    const result = writeAgentTools(config, {
        agentId: 'planner',
        agentName: 'Planner',
        tools: ['read', 'write'],
    });

    assert.deepEqual(result.agents, {
        list: [
            {
                id: 'planner',
                tools: {
                    allow: ['read', 'write'],
                    deny: [],
                    exec: {
                        security: 'allowlist',
                    },
                    profile: 'full',
                },
            },
        ],
    });
});

test('writeAgentTools denies all tools for an empty allowlist', () => {
    const result = writeAgentTools(
        {},
        {
            agentId: 'planner',
            agentName: 'Planner',
            tools: [],
        }
    );

    assert.deepEqual(result.agents, {
        list: [
            {
                id: 'planner',
                name: 'Planner',
                tools: {
                    allow: [],
                    deny: ['*'],
                },
            },
        ],
    });
});
