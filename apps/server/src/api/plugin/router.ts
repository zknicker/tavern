import { createRouter } from '../trpc.ts';
import { getBrowserSettingsProcedure } from './browser-settings.ts';
import { disconnectGoogleOAuthProcedure } from './disconnect-google-oauth.ts';
import { googleCalendarEventsProcedure } from './google-calendar-events.ts';
import { getGoogleSettingsProcedure } from './google-settings.ts';
import { listPluginsProcedure } from './list.ts';
import { merchbaseActionProcedure } from './merchbase-action.ts';
import { merchbaseSalesSeriesProcedure } from './merchbase-sales-series.ts';
import { getMerchbaseSettingsProcedure } from './merchbase-settings.ts';
import { openBrowserProcedure } from './open-browser.ts';
import { pollGoogleOAuthProcedure } from './poll-google-oauth.ts';
import { restartBrowserProcedure } from './restart-browser.ts';
import { saveBrowserSettingsProcedure } from './save-browser-settings.ts';
import { saveGoogleSettingsProcedure } from './save-google-settings.ts';
import { saveMerchbaseSettingsProcedure } from './save-merchbase-settings.ts';
import { setAgentPluginGrantProcedure } from './set-agent-grant.ts';
import { startGoogleOAuthProcedure } from './start-google-oauth.ts';

export const pluginRouter = createRouter({
    browserSettings: getBrowserSettingsProcedure,
    disconnectGoogleOAuth: disconnectGoogleOAuthProcedure,
    googleCalendarEvents: googleCalendarEventsProcedure,
    googleSettings: getGoogleSettingsProcedure,
    list: listPluginsProcedure,
    merchbaseAction: merchbaseActionProcedure,
    merchbaseSalesSeries: merchbaseSalesSeriesProcedure,
    merchbaseSettings: getMerchbaseSettingsProcedure,
    openBrowser: openBrowserProcedure,
    pollGoogleOAuth: pollGoogleOAuthProcedure,
    restartBrowser: restartBrowserProcedure,
    saveBrowserSettings: saveBrowserSettingsProcedure,
    saveGoogleSettings: saveGoogleSettingsProcedure,
    saveMerchbaseSettings: saveMerchbaseSettingsProcedure,
    setAgentGrant: setAgentPluginGrantProcedure,
    startGoogleOAuth: startGoogleOAuthProcedure,
});
