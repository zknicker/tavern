import { agentRuntimeSaveMerchbaseSettingsSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const saveMerchbaseSettingsProcedure = publicProcedure
    .input(agentRuntimeSaveMerchbaseSettingsSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.saveMerchbaseSettings(input);
        } finally {
            client.close();
        }
    });
