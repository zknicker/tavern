import { createRouter } from '../trpc.ts';
import { merchbaseActionProcedure } from './merchbase-action.ts';
import { merchbaseSalesSeriesProcedure } from './merchbase-sales-series.ts';
import { getMerchbaseSettingsProcedure } from './merchbase-settings.ts';
import { saveMerchbaseSettingsProcedure } from './save-merchbase-settings.ts';

export const pluginRouter = createRouter({
    merchbaseAction: merchbaseActionProcedure,
    merchbaseSalesSeries: merchbaseSalesSeriesProcedure,
    merchbaseSettings: getMerchbaseSettingsProcedure,
    saveMerchbaseSettings: saveMerchbaseSettingsProcedure,
});
