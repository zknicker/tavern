import { useSessionDrawer } from '../../../hooks/sessions/use-session-drawer.ts';
import type { SessionHistoryDeliveryOutput } from '../../../lib/trpc.tsx';

export function DeliveryCard({
    currentSessionKey,
    delivery,
}: {
    currentSessionKey: string;
    delivery: SessionHistoryDeliveryOutput;
}) {
    const { openSession } = useSessionDrawer();
    const outgoing = delivery.parentSessionKey === currentSessionKey;
    const targetSessionKey = outgoing ? delivery.childSessionKey : delivery.parentSessionKey;
    const targetLabel = outgoing ? delivery.childSessionName : delivery.parentSessionName;

    function handleClick() {
        openSession(targetSessionKey);
    }

    return (
        <button
            className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors ${
                outgoing
                    ? 'border-sky-500/25 bg-sky-500/10 hover:bg-sky-500/15'
                    : 'border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15'
            }`}
            onClick={handleClick}
            type="button"
        >
            <span
                className={`font-medium text-xs uppercase tracking-[0.16em] ${
                    outgoing ? 'text-sky-300' : 'text-amber-300'
                }`}
            >
                {outgoing ? `Delivered to ${targetLabel}` : `Delivered from ${targetLabel}`}
            </span>
            <span className="line-clamp-3 text-foreground/85 text-sm">
                {delivery.messageText ?? `Open ${targetLabel}`}
            </span>
            <span
                className={
                    outgoing ? 'text-caption text-sky-200/80' : 'text-amber-200/80 text-caption'
                }
            >
                Jump to {targetLabel}
            </span>
        </button>
    );
}
