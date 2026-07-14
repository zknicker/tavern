import { agentRuntimeSetChatPaneStateRequestSchema } from '@tavern/api';
import { z } from 'zod';
import { getChatPaneState, setChatPaneState } from '../../pane/service.ts';
import { createRouter, publicProcedure } from '../trpc.ts';
import { onPaneUpdate } from './on-update.ts';

const chatIdSchema = z.object({ chatId: z.string().trim().min(1) });

export const paneRouter = createRouter({
    get: publicProcedure.input(chatIdSchema).query(({ input }) => getChatPaneState(input.chatId)),
    onUpdate: onPaneUpdate,
    set: publicProcedure
        .input(agentRuntimeSetChatPaneStateRequestSchema.extend(chatIdSchema.shape))
        .mutation(({ input: { chatId, ...state } }) => setChatPaneState(chatId, state)),
});
