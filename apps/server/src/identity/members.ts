import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';
import type { ApiContext } from '../api/context.ts';

export async function listIdentityMembers(ctx: ApiContext) {
    return await withIdentityClient(
        ctx,
        false,
        async (client) => await client.listIdentityMembers()
    );
}

export async function listIdentityInvites(ctx: ApiContext) {
    return await withIdentityClient(
        ctx,
        true,
        async (client) => await client.listIdentityInvites()
    );
}

export async function createIdentityInvite(ctx: ApiContext) {
    return await withIdentityClient(
        ctx,
        true,
        async (client) => await client.createIdentityInvite()
    );
}

export async function revokeIdentityInvite(ctx: ApiContext, inviteId: string) {
    return await withIdentityClient(ctx, true, async (client) =>
        client.deleteIdentityInvite(inviteId)
    );
}

export async function removeIdentityMember(ctx: ApiContext, userId: string) {
    return await withIdentityClient(ctx, true, async (client) =>
        client.removeIdentityMember(userId)
    );
}

async function withIdentityClient<T>(
    ctx: ApiContext,
    ownerOnly: boolean,
    operation: (
        client: NonNullable<ReturnType<typeof createConfiguredAgentRuntimeClient>>
    ) => Promise<T>
) {
    if (!ctx.clerkSessionToken) {
        throw new Error('Sign in to manage Grotto members.');
    }
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Grotto Runtime is not connected.');
    }

    try {
        const me = await client.getIdentityMe(ctx.clerkSessionToken);
        if (!me.role) {
            throw new Error('Runtime membership is required.');
        }
        if (ownerOnly && me.role !== 'owner') {
            throw new Error('Only the Grotto owner can manage members and invites.');
        }
        return await operation(client);
    } finally {
        client.close();
    }
}
