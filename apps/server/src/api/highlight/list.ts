import { listHighlights } from '../../highlights/service.ts';
import { publicProcedure } from '../trpc.ts';

export const listHighlightsRoute = publicProcedure.query(async () => listHighlights());
