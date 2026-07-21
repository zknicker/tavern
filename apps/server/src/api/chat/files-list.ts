import { z } from 'zod';
import { listChatFiles } from '../../chat/files.ts';
import { publicProcedure } from '../trpc.ts';

const listChatFilesInputSchema = z.object({
    chatId: z.string().trim().min(1),
});

export const listChatFilesRoute = publicProcedure
    .input(listChatFilesInputSchema)
    .query(async ({ input }) => await listChatFiles(input.chatId));
