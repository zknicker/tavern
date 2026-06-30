import {
    agentRuntimeAgentEnvSchema,
    agentRuntimeRoutes,
    agentRuntimeSaveAgentEnvResultSchema,
    agentRuntimeSaveAgentEnvSchema,
} from '@tavern/api';
import { badRequest, json } from '../tavern/http';
import { getAgentEnv, saveAgentEnv } from './agent-env';
import { signalAgentSettingsApplied } from './settings-apply';

export async function handleAgentEnvRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== agentRuntimeRoutes.agentEnv) {
        return null;
    }

    if (request.method === 'GET') {
        return json(agentRuntimeAgentEnvSchema.parse(getAgentEnv()));
    }

    if (request.method === 'PUT') {
        let settings: ReturnType<typeof saveAgentEnv>;
        try {
            const input = agentRuntimeSaveAgentEnvSchema.parse(
                await request.json().catch(() => ({}))
            );
            settings = saveAgentEnv(input);
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }

        const restartScheduled = signalAgentSettingsApplied();

        return json(agentRuntimeSaveAgentEnvResultSchema.parse({ ...settings, restartScheduled }));
    }

    return null;
}
