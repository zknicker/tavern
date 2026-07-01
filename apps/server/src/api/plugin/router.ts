import { createRouter } from '../trpc.ts';
import { listPluginsProcedure } from './list.ts';
import { merchbaseActionProcedure } from './merchbase-action.ts';
import { merchbaseSalesSeriesProcedure } from './merchbase-sales-series.ts';
import { getMerchbaseSettingsProcedure } from './merchbase-settings.ts';
import { saveMerchbaseSettingsProcedure } from './save-merchbase-settings.ts';
import { setAgentPluginGrantProcedure } from './set-agent-grant.ts';

export const pluginRouter = createRouter({
    list: listPluginsProcedure,
    merchbaseAction: merchbaseActionProcedure,
    merchbaseSalesSeries: merchbaseSalesSeriesProcedure,
    merchbaseSettings: getMerchbaseSettingsProcedure,
    saveMerchbaseSettings: saveMerchbaseSettingsProcedure,
    setAgentGrant: setAgentPluginGrantProcedure,
});
