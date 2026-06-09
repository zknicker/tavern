import { refreshJobSchedule } from '../../jobs/manager.ts';
import { deleteOpenRouterSettings } from '../../openrouter/settings.ts';
import { deleteOpenRouterUsageOverview } from '../../storage/provider-usage.ts';
import { emitOpenRouterSettingsInvalidationCascade } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteOpenRouterSettingsProcedure = publicProcedure.mutation(async () => {
    await deleteOpenRouterUsageOverview();
    await deleteOpenRouterSettings();
    await refreshJobSchedule('sync-openrouter-usage');
    emitOpenRouterSettingsInvalidationCascade();

    return {
        apiKey: '',
        hasApiKey: false,
        hasManagementApiKey: false,
        managementApiKey: '',
        updatedAt: null,
    };
});
