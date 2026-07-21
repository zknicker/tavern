import { mkdtempSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mintAgentToken } from './agent-tokens.ts';
import { isPrincipalAllowedOnSurface, resolveRuntimeRequestAuth } from './surface-auth.ts';

const runtimeToken = 'runtime-owner-token';

describe('agent API principal scoping', () => {
    let root: string;
    let previousRoot: string | undefined;

    beforeEach(() => {
        previousRoot = process.env.TAVERN_RUNTIME_ROOT;
        root = mkdtempSync(path.join(os.tmpdir(), 'grotto-agent-auth-'));
        process.env.TAVERN_RUNTIME_ROOT = root;
    });

    afterEach(async () => {
        process.env.TAVERN_RUNTIME_ROOT = previousRoot;
        await fs.rm(root, { force: true, recursive: true });
    });

    it('resolves agent tokens and limits each principal to one surface', async () => {
        const agentToken = mintAgentToken('agt_otto');
        const clerkResolver = async () => null;
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
});
