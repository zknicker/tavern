import { agentRuntimeUpdateAgentTaskSettingsSchema } from '@tavern/api';
import * as z from 'zod';
import { updateAgentTaskSettings } from '../../agent-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const updateAgentTaskSettingsProcedure = publicProcedure
    .input(
        agentRuntimeUpdateAgentTaskSettingsSchema.and(
            z.object({ agentId: z.string().trim().min(1) })
        )
    )
    .mutation(async ({ input }) => await updateAgentTaskSettings(input));
