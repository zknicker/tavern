import { listParticipantCatalog } from '../../participants/catalog.ts';
import { publicProcedure } from '../trpc.ts';

export const listParticipantsRoute = publicProcedure.query(
    async () => await listParticipantCatalog()
);
