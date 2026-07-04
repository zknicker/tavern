import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { buildNewChatDraftPath } from '../../features/chats/chat-path.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import type { ChatMessageAttachmentInput } from '../../lib/trpc.tsx';
import type { ChatStartDraft } from './use-chat-start-drafts.tsx';
import { useChatStartDrafts } from './use-chat-start-drafts.tsx';
import { useChatTimelineStore } from './use-chat-timeline-store.tsx';

interface LaunchChatDraftInput {
    agentId: string;
    attachments?: ChatMessageAttachmentInput[];
    content: string;
}

interface ChatDraftRouteState {
    draftChatId: string;
}

export function useChatDraftLaunch() {
    const drafts = useChatStartDrafts();
    const navigate = useNavigate();
    const timeline = useChatTimelineStore();

    return (input: LaunchChatDraftInput) => {
        markChatTiming('submit', { agentId: input.agentId });
        const committedDraft: { current?: ChatStartDraft } = {};

        flushSync(() => {
            const draft = drafts.createDraft(input);
            committedDraft.current = draft;
            markChatTiming('draft.created', { draftChatId: draft.id });

            timeline.addMessage({
                attachments: draft.attachments,
                chatId: draft.id,
                content: draft.content,
                id: draft.clientMessageId,
                timestamp: draft.createdAt,
            });
        });

        const draft = committedDraft.current;
        if (!draft) {
            return;
        }

        navigate(buildNewChatDraftPath(), {
            flushSync: true,
            preventScrollReset: true,
            state: {
                draftChatId: draft.id,
            } satisfies ChatDraftRouteState,
        });
        markChatTiming('draft.navigationDispatched', { draftChatId: draft.id });
    };
}

export function getChatDraftRouteState(value: unknown): ChatDraftRouteState | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const draftChatId = (value as { draftChatId?: unknown }).draftChatId;

    return typeof draftChatId === 'string' && draftChatId.trim().length > 0
        ? { draftChatId }
        : null;
}
