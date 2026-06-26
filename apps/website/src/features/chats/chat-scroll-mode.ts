// Pure state machine for chat viewport scroll ownership. The controller in
// use-chat-scroll-controller.ts interprets app-owned transitions; virtualized
// chat surfaces leave item measurement compensation to TanStack Virtual.
// See specs/chat-scroll-controller.md.

export type ChatScrollMode = 'following' | 'anchored' | 'free' | 'historyNavigating';

export type ChatScrollEvent =
    | { type: 'anchorEnded'; isAtBottom: boolean }
    | { type: 'anchorStarted' }
    | { type: 'contentResized' }
    | { type: 'followRequested' }
    | { type: 'historyNavigationSettled'; isAtBottom: boolean }
    | { type: 'historyNavigationStarted' }
    | { type: 'scrolled'; isAtBottom: boolean; userInitiated: boolean }
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
        case 'historyNavigationStarted':
            return { action: 'none', mode: 'historyNavigating' };
        case 'historyNavigationSettled':
            if (mode !== 'historyNavigating') {
                return { action: 'none', mode };
            }

            return { action: 'none', mode: event.isAtBottom ? 'following' : 'free' };
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

            // The first frame of a smooth history navigation can still be
            // inside the bottom tolerance. Do not resume following until the
            // scroll leaves the tail or the history navigation settles.
            if (mode === 'historyNavigating') {
                return { action: 'none', mode: event.isAtBottom ? mode : 'free' };
            }

            if (mode === 'following' && !event.isAtBottom && !event.userInitiated) {
                return { action: 'pinBottom', mode: 'following' };
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
const followVirtualizerSizeAdjustment = () => true;

export function getVirtualizerSizeAdjustmentPredicate(mode: ChatScrollMode) {
    if (mode === 'anchored') {
        return suppressVirtualizerSizeAdjustment;
    }

    if (mode === 'following') {
        return followVirtualizerSizeAdjustment;
    }

    return undefined;
}

// "Near bottom" tolerance: smaller than the virtualized transcript end inset
// so a clipped tail row never counts as bottom, but still roomy enough for
// sub-pixel rounding and momentum overshoot.
const bottomTolerancePx = 48;

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
