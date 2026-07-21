import { appRoutes } from '../../lib/app-routes.ts';

export function buildChatPath(chatId: string) {
    return appRoutes.chat(chatId);
}

export function buildDefaultWorkspaceChatPath() {
    return appRoutes.overview;
}
