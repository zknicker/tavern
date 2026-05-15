import { getOpenClawConfigState } from '../../openclaw-config/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getOpenClawConfigProcedure = publicProcedure.query(
    async () => await getOpenClawConfigState()
);
