import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { getChatCardDomId } from './chat-card-dom-id.ts';

export function useFocusedChatCard(chatIds: string[]) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [highlightedChatId, setHighlightedChatId] = React.useState<string | null>(null);
    const focusedChatId = searchParams.get('chatId');

    React.useLayoutEffect(() => {
        if (!(focusedChatId && chatIds.includes(focusedChatId))) {
            return;
        }

        const target = document.getElementById(getChatCardDomId(focusedChatId));

        if (!target) {
            return;
        }

        target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
        });
        setHighlightedChatId(focusedChatId);
        setSearchParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.delete('chatId');
                return next;
            },
            { replace: true }
        );

        const timer = window.setTimeout(() => {
            setHighlightedChatId((current) => (current === focusedChatId ? null : current));
        }, 2000);

        return () => {
            window.clearTimeout(timer);
        };
    }, [chatIds, focusedChatId, setSearchParams]);

    return highlightedChatId;
}
