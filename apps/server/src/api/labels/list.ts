import { listTaskLabels } from '../../agent-runtime/labels.ts';
import { publicProcedure } from '../trpc.ts';
import { labelListSchema } from './contracts.ts';

export const listLabelsRoute = publicProcedure.query(async () => {
    return labelListSchema.parse(await listTaskLabels());
});
