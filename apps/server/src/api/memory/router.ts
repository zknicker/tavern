import { createRouter } from '../trpc.ts';
import { getMemoryJobProcedure, listMemoryJobsProcedure, runMemoryDreamProcedure } from './jobs.ts';
import { getMemorySettingsProcedure, saveMemorySettingsProcedure } from './settings.ts';

export const memoryRouter = createRouter({
    getJob: getMemoryJobProcedure,
    jobs: listMemoryJobsProcedure,
    runDream: runMemoryDreamProcedure,
    settings: getMemorySettingsProcedure,
    saveSettings: saveMemorySettingsProcedure,
});
