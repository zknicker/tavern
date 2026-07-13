import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { forbidden } from '../tavern/http.ts';

export function requireTavernSettingsMutation(request: Request, label: string) {
    if (
        request.headers.get(agentRuntimeMutationHeaders.origin) ===
        agentRuntimeMutationOrigins.tavern
    ) {
        return null;
    }

    return forbidden(`${label} can only be changed by Tavern.`);
}
