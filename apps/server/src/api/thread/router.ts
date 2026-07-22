import { createRouter } from '../trpc.ts';
import { setThreadFollowRoute } from './set-follow.ts';

export const threadRouter = createRouter({
    setFollow: setThreadFollowRoute,
});
