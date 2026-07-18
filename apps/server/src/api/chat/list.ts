import { listArchivedChats, listChats } from '../../chat/list.ts';
import { resolveActingUserId } from '../../identity/acting-user.ts';
import { publicProcedure } from '../trpc.ts';

export const listChatsRoute = publicProcedure.query(async ({ ctx }) =>
    listChats(await resolveActingUserId(ctx))
);

export const listArchivedChatsRoute = publicProcedure.query(async ({ ctx }) =>
    listArchivedChats(await resolveActingUserId(ctx))
);
