import { agentRuntimeSaveGoogleSettingsSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const saveGoogleSettingsProcedure = publicProcedure
    .input(agentRuntimeSaveGoogleSettingsSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Grotto Runtime is not connected.');
        }

        try {
            return await client.saveGoogleSettings(input);
        } finally {
            client.close();
        }
    });
