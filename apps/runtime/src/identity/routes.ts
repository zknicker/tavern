import {
    runtimeIdentityMeSchema,
    runtimeInviteRedeemRequestSchema,
    runtimeRoutes,
} from '@tavern/api';
import { badRequest, forbidden, json, notFound, readJson } from '../tavern/http.ts';
import type { RuntimeRequestAuth } from './auth.ts';
import { createInvite, deleteInvite, listInvites, redeemInvite } from './invites.ts';
import { getOwner, listMembers, removeMember } from './members.ts';

export async function handleIdentityRequest(
    request: Request,
    auth: RuntimeRequestAuth
): Promise<Response | undefined> {
    const url = new URL(request.url);
    const { method } = request;
    const path = url.pathname;

    if (!path.startsWith('/identity/')) {
        return;
    }

    if (method === 'GET' && path === runtimeRoutes.identityMe) {
        if (auth.kind !== 'user') {
            return badRequest('Identity introspection requires a user token.');
        }
        return json(runtimeIdentityMeSchema.parse({ role: auth.role, user: auth.user }));
    }

    if (method === 'POST' && path === runtimeRoutes.identityInviteRedeem) {
        if (auth.kind !== 'user') {
            return badRequest('Invite redemption requires a user token.');
        }
        const body = runtimeInviteRedeemRequestSchema.safeParse(await readJson(request));
        if (!body.success) {
            return badRequest('Invite code required.');
        }
        const outcome = redeemInvite(body.data.code, auth.user.id);
        if (!outcome.ok) {
            return badRequest(`Invite redemption failed: ${outcome.reason}.`);
        }
        return json({ ok: true });
    }

    if (method === 'GET' && path === runtimeRoutes.identityMembers) {
        if (auth.kind === 'user' && auth.role === null) {
            return forbidden('Runtime membership required.');
        }
        return json({ members: listMembers() });
    }

    if (!isAdmin(auth)) {
        return forbidden('Runtime owner access required.');
    }

    if (method === 'DELETE' && path.startsWith('/identity/members/')) {
        const userId = decodeURIComponent(path.slice('/identity/members/'.length));
        try {
            removeMember(userId);
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : 'Member removal failed.');
        }
        return json({ ok: true });
    }

    if (method === 'GET' && path === runtimeRoutes.identityInvites) {
        return json({ invites: listInvites() });
    }

    if (method === 'POST' && path === runtimeRoutes.identityInvites) {
        const createdBy = auth.kind === 'user' ? auth.user.id : getOwner()?.user.id;
        if (!createdBy) {
            return badRequest('Invites require a claimed runtime owner.');
        }
        return json({ invite: createInvite(createdBy) });
    }

    if (method === 'DELETE' && path.startsWith('/identity/invites/')) {
        deleteInvite(decodeURIComponent(path.slice('/identity/invites/'.length)));
        return json({ ok: true });
    }

    return notFound();
}

function isAdmin(auth: RuntimeRequestAuth): boolean {
    return auth.kind === 'runtime-token' || (auth.kind === 'user' && auth.role === 'owner');
}
