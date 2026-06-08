import { getHermesConfigState } from '../../hermes-config/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getHermesConfigProcedure = publicProcedure.query(
    async () => await getHermesConfigState()
);
