export const defaultWorkspaceChannelId = 'cht_general';

export function buildChatPath(chatId: string) {
    return `/dashboard/chats/${chatId}`;
}

export function buildDefaultWorkspaceChatPath() {
    return buildChatPath(defaultWorkspaceChannelId);
}

export function buildNewChatDraftPath() {
    return '/dashboard/chats/new';
}
