import * as React from 'react';

const chatComposerMentionEventName = 'tavern:chat-composer-mention-request';

export function requestChatComposerMention({ agentId }: { agentId: string }) {
    window.dispatchEvent(new CustomEvent(chatComposerMentionEventName, { detail: { agentId } }));
}

export function useChatComposerMentionRequest(
    enabled: boolean,
    mention: (request: { agentId: string }) => void
) {
    React.useEffect(() => {
        if (!enabled) {
            return;
        }

        const listener = (event: Event) => {
            const detail = (event as CustomEvent<{ agentId?: unknown }>).detail;
            if (typeof detail?.agentId === 'string' && detail.agentId.length > 0) {
                mention({ agentId: detail.agentId });
            }
        };

        window.addEventListener(chatComposerMentionEventName, listener);
        return () => window.removeEventListener(chatComposerMentionEventName, listener);
    }, [enabled, mention]);
}
