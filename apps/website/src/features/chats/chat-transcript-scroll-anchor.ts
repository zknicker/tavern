export const transcriptDisclosureAnchorStartEvent = 'tavern:chat-disclosure-anchor-start';
export const transcriptDisclosureAnchorEndEvent = 'tavern:chat-disclosure-anchor-end';

export function dispatchTranscriptDisclosureAnchorStart() {
    window.dispatchEvent(new CustomEvent(transcriptDisclosureAnchorStartEvent));
}

export function dispatchTranscriptDisclosureAnchorEnd() {
    window.dispatchEvent(new CustomEvent(transcriptDisclosureAnchorEndEvent));
}
