import { type ChatTimingMarkName, markChatTiming } from '../../lib/chat-timing.ts';

export function createChatStartTiming(label: string) {
    const startedAt = performance.now();
    let previousAt = startedAt;

    return (step: ChatTimingMarkName, fields: Record<string, string | undefined> = {}) => {
        const now = performance.now();
        const elapsedMs = Math.round(now - startedAt);
        const stepMs = Math.round(now - previousAt);
        previousAt = now;

        markChatTiming(step, {
            ...fields,
            elapsedMs,
            label,
            step,
            stepMs,
        });
    };
}
