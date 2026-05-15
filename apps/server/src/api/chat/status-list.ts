import { listChatStatuses } from '../../chat/status.ts';
import { publicProcedure } from '../trpc.ts';

export const listChatStatusesRoute = publicProcedure.query(async () => listChatStatuses());
