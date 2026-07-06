import { createRouter } from '../trpc.ts';
import { disconnectGoogleOAuthProcedure } from './disconnect-google-oauth.ts';
import { googleCalendarEventsProcedure } from './google-calendar-events.ts';
import { getGoogleSettingsProcedure } from './google-settings.ts';
import { listPluginsProcedure } from './list.ts';
import { merchbaseActionProcedure } from './merchbase-action.ts';
import { merchbaseSalesSeriesProcedure } from './merchbase-sales-series.ts';
import { getMerchbaseSettingsProcedure } from './merchbase-settings.ts';
import { pollGoogleOAuthProcedure } from './poll-google-oauth.ts';
import { saveGoogleSettingsProcedure } from './save-google-settings.ts';
import { saveMerchbaseSettingsProcedure } from './save-merchbase-settings.ts';
import { setAgentPluginGrantProcedure } from './set-agent-grant.ts';
import { startGoogleOAuthProcedure } from './start-google-oauth.ts';

export const pluginRouter = createRouter({
    disconnectGoogleOAuth: disconnectGoogleOAuthProcedure,
    googleCalendarEvents: googleCalendarEventsProcedure,
    googleSettings: getGoogleSettingsProcedure,
    list: listPluginsProcedure,
    merchbaseAction: merchbaseActionProcedure,
    merchbaseSalesSeries: merchbaseSalesSeriesProcedure,
    merchbaseSettings: getMerchbaseSettingsProcedure,
    pollGoogleOAuth: pollGoogleOAuthProcedure,
    saveGoogleSettings: saveGoogleSettingsProcedure,
    saveMerchbaseSettings: saveMerchbaseSettingsProcedure,
    setAgentGrant: setAgentPluginGrantProcedure,
    startGoogleOAuth: startGoogleOAuthProcedure,
});
