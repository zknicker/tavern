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
