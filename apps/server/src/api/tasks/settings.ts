import { agentRuntimeSaveAutoDispatchSettingsSchema } from '@tavern/api';
import { requireActiveTaskRuntime } from '../../tasks/mutations.ts';
import { publicProcedure } from '../trpc.ts';

export const getAutoDispatchSettingsRoute = publicProcedure.query(async () => {
    const { client } = await requireActiveTaskRuntime();
    return await client.getAutoDispatchSettings();
});

export const saveAutoDispatchSettingsRoute = publicProcedure
    .input(agentRuntimeSaveAutoDispatchSettingsSchema)
    .mutation(async ({ input }) => {
        const { client } = await requireActiveTaskRuntime();
        return await client.saveAutoDispatchSettings(input);
    });
