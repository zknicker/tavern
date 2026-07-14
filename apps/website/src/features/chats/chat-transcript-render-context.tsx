import * as React from 'react';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';

export interface TranscriptRenderContextValue {
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    hiddenCount: number;
    /** Runs whose final reply is present anywhere in the transcript. */
    repliedRunIds: ReadonlySet<string>;
    /**
     * Whether an item mounting now lands at the live edge and should animate
     * in. False for everything present at first render and for older history
     * pages loading in.
     */
    shouldAnimateItemEnter: (key: string, timestampMs: number | null) => boolean;
}

const TranscriptRenderContext = React.createContext<TranscriptRenderContextValue | null>(null);

export function TranscriptRenderProvider({
    children,
    value,
}: {
    children: React.ReactNode;
    value: TranscriptRenderContextValue;
}) {
    return <TranscriptRenderContext value={value}>{children}</TranscriptRenderContext>;
}

export function useTranscriptRenderContext() {
    const context = React.useContext(TranscriptRenderContext);

    if (!context) {
        throw new Error('Transcript render context is missing.');
    }

    return context;
}

// Turn content also renders outside the transcript pane (the turn drawer),
// where no render context exists and enter animation never applies.
export function useTranscriptRenderContextOptional() {
    return React.useContext(TranscriptRenderContext);
}
