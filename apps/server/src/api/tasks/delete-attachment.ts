import { deleteTaskAttachment } from '../../tasks/attachments.ts';
import { taskAttachmentInputSchema } from '../../tasks/contracts.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteTaskAttachmentRoute = publicProcedure
    .input(taskAttachmentInputSchema)
    .mutation(async ({ input }) => {
        return await deleteTaskAttachment(input);
    });
