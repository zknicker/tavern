import { createRouter } from '../trpc.ts';
import {
    listMentionInventoryProcedure,
    listMentionPathOptionsProcedure,
} from './list.ts';

export const mentionRouter = createRouter({
    inventory: listMentionInventoryProcedure,
    paths: listMentionPathOptionsProcedure,
});
