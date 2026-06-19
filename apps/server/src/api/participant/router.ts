import { createRouter } from '../trpc.ts';
import { listParticipantsRoute } from './list.ts';

export const participantRouter = createRouter({
    list: listParticipantsRoute,
});
