import { createRouter } from '../trpc.ts';
import { getMemoryActivityProcedure } from './activity.ts';
import { getMemoryJobProcedure, listMemoryJobsProcedure, runMemoryDreamProcedure } from './jobs.ts';
import { onMemoryJobsUpdate } from './on-update.ts';
import { getMemorySettingsProcedure, saveMemorySettingsProcedure } from './settings.ts';

export const memoryRouter = createRouter({
    activity: getMemoryActivityProcedure,
    getJob: getMemoryJobProcedure,
    jobs: listMemoryJobsProcedure,
    onJobsUpdate: onMemoryJobsUpdate,
    runDream: runMemoryDreamProcedure,
    settings: getMemorySettingsProcedure,
    saveSettings: saveMemorySettingsProcedure,
});
