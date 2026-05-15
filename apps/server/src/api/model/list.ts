import { listModels } from '../../model/service.ts';
import { publicProcedure } from '../trpc.ts';

export const listModelsProcedure = publicProcedure.query(async () => await listModels());
