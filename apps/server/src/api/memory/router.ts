import { createRouter } from '../trpc.ts';
import { getMemoryJobProcedure, listMemoryJobsProcedure, runMemoryDreamProcedure } from './jobs.ts';
import { onMemoryJobsUpdate } from './on-update.ts';
import { getMemorySettingsProcedure, saveMemorySettingsProcedure } from './settings.ts';
import { listMemoryWorkersProcedure } from './workers.ts';

export const memoryRouter = createRouter({
    getJob: getMemoryJobProcedure,
    jobs: listMemoryJobsProcedure,
    onJobsUpdate: onMemoryJobsUpdate,
    runDream: runMemoryDreamProcedure,
    settings: getMemorySettingsProcedure,
    saveSettings: saveMemorySettingsProcedure,
    workers: listMemoryWorkersProcedure,
});
