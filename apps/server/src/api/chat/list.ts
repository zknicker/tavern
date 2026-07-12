import { listArchivedChats, listChats } from '../../chat/list.ts';
import { publicProcedure } from '../trpc.ts';

export const listChatsRoute = publicProcedure.query(async () => await listChats());

export const listArchivedChatsRoute = publicProcedure.query(async () => await listArchivedChats());
