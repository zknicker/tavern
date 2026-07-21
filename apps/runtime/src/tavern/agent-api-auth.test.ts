import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAgentToolEnvironment } from '../agent-engine/agent-cli-wrapper.ts';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { agentTokenPath, mintAgentToken } from './agent-tokens.ts';
import { deleteStoredAgent, upsertStoredAgent } from './agents-store.ts';
import { isPrincipalAllowedOnSurface, resolveRuntimeRequestAuth } from './surface-auth.ts';

const runtimeToken = 'runtime-owner-token';
const clerkResolver = async () => null;

describe('agent API principal scoping', () => {
    let root: string;
    let previousRoot: string | undefined;

    beforeEach(() => {
        previousRoot = process.env.TAVERN_RUNTIME_ROOT;
        root = initAgentApiTestDb('grotto-agent-auth-');
        process.env.TAVERN_RUNTIME_ROOT = root;
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_otto',
                isAdmin: false,
                name: 'Otto',
                primaryColor: null,
                workspaceFolder: `${root}/otto`,
            },
        });
    });

    afterEach(async () => {
        process.env.TAVERN_RUNTIME_ROOT = previousRoot;
        await closeAgentApiTestDb(root);
    });

    it('resolves agent tokens and limits each principal to one surface', async () => {
        const agentToken = mintAgentToken('agt_otto');
        const agent = await resolveRuntimeRequestAuth(
            `Bearer ${agentToken}`,
            runtimeToken,
            clerkResolver
        );
        const runtime = await resolveRuntimeRequestAuth(
            `Bearer ${runtimeToken}`,
            runtimeToken,
            clerkResolver
        );

        expect(agent).toEqual({ agentId: 'agt_otto', kind: 'agent-token' });
        expect(runtime).toEqual({ kind: 'runtime-token' });
        expect(agent && isPrincipalAllowedOnSurface(agent, '/api/agent/server')).toBe(true);
        expect(agent && isPrincipalAllowedOnSurface(agent, '/api/chats')).toBe(false);
        expect(runtime && isPrincipalAllowedOnSurface(runtime, '/api/agent/server')).toBe(false);
        expect(runtime && isPrincipalAllowedOnSurface(runtime, '/api/chats')).toBe(true);
        expect(
            isPrincipalAllowedOnSurface(
                {
                    kind: 'user',
                    role: 'member',
                    user: {
                        avatarUrl: null,
                        clerkUserId: 'clerk_1',
                        createdAt: '2026-07-21T00:00:00.000Z',
                        email: null,
                        id: 'usr_1',
                        name: 'Zach',
                        updatedAt: '2026-07-21T00:00:00.000Z',
                    },
                },
                '/api/agent/server'
            )
        ).toBe(false);
    });

    it('removes credentials on agent deletion and rejects stray token files', async () => {
        const agentToken = mintAgentToken('agt_otto');
        const tooling = buildAgentToolEnvironment('agt_otto');
        expect(existsSync(tooling.wrapperPath)).toBe(true);

        deleteStoredAgent('agt_otto');
        expect(existsSync(agentTokenPath('agt_otto'))).toBe(false);
        expect(existsSync(tooling.wrapperPath)).toBe(false);

        // A stray token file (cleanup missed, or agent record gone) must not authenticate.
        const strayToken = mintAgentToken('agt_otto');
        expect(
            await resolveRuntimeRequestAuth(`Bearer ${strayToken}`, runtimeToken, clerkResolver)
        ).toBeNull();
        expect(
            await resolveRuntimeRequestAuth(`Bearer ${agentToken}`, runtimeToken, clerkResolver)
        ).toBeNull();
    });
});
