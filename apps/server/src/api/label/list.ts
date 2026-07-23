import { listRuntimeLabels } from '../../task-reminders/runtime-api.ts';
import { publicProcedure } from '../trpc.ts';

export const listLabelsRoute = publicProcedure.query(async () => await listRuntimeLabels());
