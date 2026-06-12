import { getSkillHubAvailable } from '../../skills/hub-service.ts';
import { publicProcedure } from '../trpc.ts';

export const skillHubAvailableProcedure = publicProcedure.query(
    async () => await getSkillHubAvailable()
);
