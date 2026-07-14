import {
    agentRuntimeChatPaneStateSchema,
    agentRuntimeSetChatPaneStateRequestSchema,
    agentRuntimeSetChatPaneStateResultSchema,
} from '@tavern/api';
import { badRequest, json, readJson } from '../tavern/http.ts';
import { publishPaneUpdated } from './events.ts';
import { ChatPaneRevisionConflictError, getChatPaneState, setChatPaneState } from './store.ts';

export async function handleChatPaneRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const matches =
        segments[0] === 'agent' &&
        segments[1] === 'chats' &&
        Boolean(segments[2]) &&
        segments[3] === 'pane-state' &&
        !segments[4];
    if (!matches) {
        return null;
    }
    const chatId = segments[2] as string;

    try {
        if (request.method === 'GET') {
            return json(agentRuntimeChatPaneStateSchema.parse(getChatPaneState(chatId)));
        }
        if (request.method === 'PUT') {
            const input = agentRuntimeSetChatPaneStateRequestSchema.parse(await readJson(request));
            try {
                const state = setChatPaneState(chatId, input);
                publishPaneUpdated(chatId, state.revision);
                return json(
                    agentRuntimeSetChatPaneStateResultSchema.parse({ conflict: false, state })
                );
            } catch (error) {
                if (error instanceof ChatPaneRevisionConflictError) {
                    return json(
                        agentRuntimeSetChatPaneStateResultSchema.parse({
                            conflict: true,
                            state: error.current,
                        }),
                        409
                    );
                }
                throw error;
            }
        }
        return null;
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }
}
