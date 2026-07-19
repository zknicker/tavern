import { describe, expect, mock, test } from 'bun:test';
import { agentRuntimeProtocolVersion } from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { setCurrentSessionToken } from '../identity/session-token-store.ts';
import { checkAgentRuntimeConnection } from './connection-check.ts';

describe('clerk-session runtime connect', () => {
    test('uses the current session for capabilities and identity probes', async () => {
        const listCapabilities = mock(async () => ({
            capabilities: [],
            health: {
                ok: true as const,
                status: 'healthy' as const,
                timestamp: '2026-07-18T12:00:00.000Z',
            },
            info: {
                agentRuntimeId: 'runtime-member-test',
                name: 'Member Runtime',
                protocolVersion: agentRuntimeProtocolVersion,
                version: '1.5.2',
            },
        }));
        const getIdentityMe = mock(async () => ({
            role: 'member' as const,
            user: {
                avatarUrl: null,
                clerkUserId: 'user_member',
                createdAt: '2026-07-18T12:00:00.000Z',
                email: null,
                id: 'usr_member' as const,
                name: null,
                updatedAt: '2026-07-18T12:00:00.000Z',
            },
        }));
        const close = mock(() => undefined);
        const createClient = mock((connection: { authJson?: null | string; baseUrl: string }) => {
            expect(connection).toEqual({
                authJson: JSON.stringify({ kind: 'clerk-session' }),
                baseUrl: 'http://runtime.test',
            });
            return {
                close,
                getIdentityMe,
                listCapabilities,
            } as unknown as TavernAgentRuntimeClient;
        });
        setCurrentSessionToken('current-clerk-session');

        await expect(
            checkAgentRuntimeConnection(
                {
                    auth: { kind: 'clerk-session' },
                    baseUrl: 'http://runtime.test',
                },
                createClient
            )
        ).resolves.toMatchObject({ baseUrl: 'http://runtime.test' });
        expect(listCapabilities).toHaveBeenCalledTimes(1);
        expect(getIdentityMe).toHaveBeenCalledWith('current-clerk-session');
        expect(close).toHaveBeenCalledTimes(1);
    });
});
