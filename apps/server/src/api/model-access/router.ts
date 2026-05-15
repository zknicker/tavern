import { createRouter } from '../trpc.ts';
import { getModelAccessProcedure } from './get.ts';
import { saveClaudeCredentialProcedure } from './save-claude-credential.ts';
import { saveCodexCredentialProcedure } from './save-codex-credential.ts';

export const modelAccessRouter = createRouter({
    get: getModelAccessProcedure,
    saveClaudeCredential: saveClaudeCredentialProcedure,
    saveCodexCredential: saveCodexCredentialProcedure,
});
