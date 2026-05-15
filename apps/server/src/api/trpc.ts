import { initTRPC } from '@trpc/server';
import type { ApiContext } from './context.ts';

const t = initTRPC.context<ApiContext>().create();

export const createRouter = t.router;
export const publicProcedure = t.procedure;
