import { agentRuntimeSavePermissionSettingsSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const getAgentPermissionSettingsProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not connected.');
    }

    try {
        return await client.getPermissionSettings();
    } finally {
        client.close();
    }
});

export const saveAgentPermissionSettingsProcedure = publicProcedure
    .input(agentRuntimeSavePermissionSettingsSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.savePermissionSettings(input);
        } finally {
            client.close();
        }
    });
