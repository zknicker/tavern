import { createRouter } from '../trpc.ts';
import { getMemorySettingsProcedure } from './get.ts';
import { saveMemorySettingsProcedure } from './save.ts';
import { getMemoryStatusProcedure } from './status.ts';

export const memoryRouter = createRouter({
    get: getMemorySettingsProcedure,
    save: saveMemorySettingsProcedure,
    status: getMemoryStatusProcedure,
});
