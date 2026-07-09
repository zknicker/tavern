import { getTaskAttachment } from '../../tasks/attachments.ts';
import { taskAttachmentInputSchema } from '../../tasks/contracts.ts';
import { publicProcedure } from '../trpc.ts';

export const getTaskAttachmentRoute = publicProcedure
    .input(taskAttachmentInputSchema)
    .query(async ({ input }) => {
        return await getTaskAttachment(input);
    });
