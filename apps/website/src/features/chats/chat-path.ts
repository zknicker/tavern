import { appRoutes } from '../../lib/app-routes.ts';

export const defaultWorkspaceChannelId = 'cht_general';

export function buildChatPath(chatId: string) {
    return appRoutes.chat(chatId);
}

export function buildDefaultWorkspaceChatPath() {
    return buildChatPath(defaultWorkspaceChannelId);
}

export function buildNewChatDraftPath() {
    return appRoutes.newChatDraft;
}
