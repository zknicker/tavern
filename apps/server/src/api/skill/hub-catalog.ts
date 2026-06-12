import { getSkillHubCatalog } from '../../skills/hub-service.ts';
import { publicProcedure } from '../trpc.ts';

export const skillHubCatalogProcedure = publicProcedure.query(
    async () => await getSkillHubCatalog()
);
