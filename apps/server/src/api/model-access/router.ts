import { createRouter } from '../trpc.ts';
import { cancelModelProviderOAuthProcedure } from './cancel-provider-oauth.ts';
import { getModelAccessProcedure } from './get.ts';
import { pollModelProviderOAuthProcedure } from './poll-provider-oauth.ts';
import { saveModelProviderApiKeyProcedure } from './save-provider-api-key.ts';
import { startModelProviderOAuthProcedure } from './start-provider-oauth.ts';
import { submitModelProviderOAuthProcedure } from './submit-provider-oauth.ts';

export const modelAccessRouter = createRouter({
    cancelProviderOAuth: cancelModelProviderOAuthProcedure,
    get: getModelAccessProcedure,
    pollProviderOAuth: pollModelProviderOAuthProcedure,
    saveProviderApiKey: saveModelProviderApiKeyProcedure,
    startProviderOAuth: startModelProviderOAuthProcedure,
    submitProviderOAuth: submitModelProviderOAuthProcedure,
});
