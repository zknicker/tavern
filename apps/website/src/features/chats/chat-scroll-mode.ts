// Pure state machine for chat viewport scroll ownership. The controller in
// use-chat-scroll-controller.ts interprets app-owned transitions; virtualized
// chat surfaces leave item measurement compensation to TanStack Virtual.
// See specs/chat-scroll-controller.md.

export type ChatScrollMode = 'following' | 'anchored' | 'free';

export type ChatScrollEvent =
    | { type: 'anchorEnded'; isAtBottom: boolean }
    | { type: 'anchorStarted' }
    | { type: 'contentResized' }
    | { type: 'followRequested' }
    | { type: 'scrolled'; isAtBottom: boolean }
    | { type: 'userScrolled'; isAtBottom: boolean };

export type ChatScrollAction = 'none' | 'pinBottom' | 'scrollToBottom';

export interface ChatScrollTransition {
    action: ChatScrollAction;
    mode: ChatScrollMode;
}

export const initialChatScrollMode: ChatScrollMode = 'following';

export function transitionChatScrollMode(
    mode: ChatScrollMode,
    event: ChatScrollEvent
): ChatScrollTransition {
    switch (event.type) {
        case 'followRequested':
            return { action: 'scrollToBottom', mode: 'following' };
        case 'anchorStarted':
            return { action: 'none', mode: 'anchored' };
        case 'anchorEnded':
            if (mode !== 'anchored') {
                return { action: 'none', mode };
            }

            return { action: 'none', mode: event.isAtBottom ? 'following' : 'free' };
        case 'contentResized':
            return { action: mode === 'following' ? 'pinBottom' : 'none', mode };
        case 'scrolled':
            // The anchor's own scrollTop writes fire scroll events; only
            // explicit user input (wheel/touch) may cancel an anchor.
            if (mode === 'anchored') {
                return { action: 'none', mode };
            }

            return { action: 'none', mode: event.isAtBottom ? 'following' : 'free' };
        case 'userScrolled':
            return { action: 'none', mode: event.isAtBottom ? 'following' : 'free' };
        default:
            return { action: 'none', mode };
    }
}

export function shouldAnchorVirtualizerToEnd(mode: ChatScrollMode) {
    return mode !== 'anchored';
}

const suppressVirtualizerSizeAdjustment = () => false;

export function getVirtualizerSizeAdjustmentPredicate(mode: ChatScrollMode) {
    return mode === 'anchored' ? suppressVirtualizerSizeAdjustment : undefined;
}

// "Near bottom" tolerance: small enough that reading history never follows,
// large enough that sub-pixel rounding and momentum overshoot still count.
const bottomTolerancePx = 72;

export function isNearBottom(metrics: {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
}) {
    return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= bottomTolerancePx;
}

// While anchored, the controller keeps a disclosure trigger at its captured
// viewport Y. Returns the scrollTop correction, or null when the trigger has
// not meaningfully moved — e.g. a collapse at scrollTop 0 where the content
// shrinks below the trigger and no write should happen.
const anchorWriteThresholdPx = 0.5;

export function getAnchorScrollDelta(positions: { capturedTop: number; currentTop: number }) {
    const delta = positions.currentTop - positions.capturedTop;

    return Math.abs(delta) >= anchorWriteThresholdPx ? delta : null;
}
