import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as configuredClient from '../agent-runtime/configured-client.ts';
import { resolveActingUserId } from './acting-user.ts';

afterEach(() => {
    mock.restore();
});

describe('resolveActingUserId', () => {
    test('uses the synthetic operator only when no Clerk token is present', async () => {
        expect(await resolveActingUserId({ clerkSessionToken: null })).toBe('usr_tavern');
    });

    test('caches a resolved runtime user for the same token', async () => {
        const getIdentityMe = mock(async () => ({ user: { id: 'usr_cached' } }));
        const close = mock(() => undefined);
        spyOn(configuredClient, 'createConfiguredAgentRuntimeClient').mockReturnValue({
            close,
            getIdentityMe,
        } as unknown as ReturnType<typeof configuredClient.createConfiguredAgentRuntimeClient>);

        const context = { clerkSessionToken: 'session-cache-test' };
        expect(await resolveActingUserId(context)).toBe('usr_cached');
        expect(await resolveActingUserId(context)).toBe('usr_cached');
        expect(getIdentityMe).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledTimes(1);
    });

    test('fails clearly instead of falling back when runtime resolution fails', async () => {
        spyOn(configuredClient, 'createConfiguredAgentRuntimeClient').mockReturnValue({
            close: mock(() => undefined),
            getIdentityMe: mock(async () => {
                throw new Error('401');
            }),
        } as unknown as ReturnType<typeof configuredClient.createConfiguredAgentRuntimeClient>);

        await expect(
            resolveActingUserId({ clerkSessionToken: 'session-failure-test' })
        ).rejects.toThrow('Unable to resolve the acting Tavern user from Runtime.');
    });
});
