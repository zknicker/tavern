import { createRouter } from '../trpc.ts';
import { getSessionRoute } from './get.ts';
import { getSessionHistoryRoute } from './history-get.ts';
import { listSessionsRoute } from './list.ts';
import { listSessionLogRoute } from './log-list.ts';
import { getSessionPromptRoute } from './prompt-get.ts';
import { resyncSessionRoute } from './resync.ts';
import { getSessionToolRoute } from './tool-get.ts';

export const sessionRouter = createRouter({
    get: getSessionRoute,
    list: listSessionsRoute,
    resync: resyncSessionRoute,
    log: createRouter({
        list: listSessionLogRoute,
    }),
    prompt: createRouter({
        get: getSessionPromptRoute,
    }),
    history: createRouter({
        get: getSessionHistoryRoute,
    }),
    tool: createRouter({
        get: getSessionToolRoute,
    }),
});
