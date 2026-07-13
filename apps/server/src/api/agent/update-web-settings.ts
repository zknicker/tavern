import { agentRuntimeUpdateAgentWebSettingsSchema } from '@tavern/api';
import * as z from 'zod';
import { updateAgentWebSettings } from '../../agent-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const updateAgentWebSettingsProcedure = publicProcedure
    .input(
        agentRuntimeUpdateAgentWebSettingsSchema.and(
            z.object({ agentId: z.string().trim().min(1) })
        )
    )
    .mutation(async ({ input }) => await updateAgentWebSettings(input));
