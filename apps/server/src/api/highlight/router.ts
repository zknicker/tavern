import { createRouter } from '../trpc.ts';
import { listHighlightsRoute } from './list.ts';

export const highlightRouter = createRouter({
    list: listHighlightsRoute,
});
