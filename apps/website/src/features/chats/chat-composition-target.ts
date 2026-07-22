import { getChannelName, getDmPeerName, type ThreadTargetChat } from './thread/thread-target.ts';

/**
 * The `grotto message send --target <t>` grammar for a chat itself, no
 * thread suffix (specs/grotto-cli.md): `#channel` or `dm:@peer`. Used to
 * scope an ephemeral `agent.composition` event to the chat it belongs to.
 * Null for chats the CLI target grammar cannot address (tasks, threads).
 */
export function resolveChatCompositionTarget(chat: ThreadTargetChat): string | null {
    if (chat.conversationKind === 'direct' || chat.scope === 'dm') {
        return `dm:@${getDmPeerName(chat)}`;
    }

    if (chat.conversationKind === 'task' || chat.scope === 'task') {
        return null;
    }

    return `#${getChannelName(chat)}`;
}
