import type { SessionHistoryDeliveryOutput } from '../../../../lib/trpc.tsx';
import { DeliveryCard } from '../delivery-card.tsx';

export function DeliveryLogEntry({
    currentSessionKey,
    delivery,
}: {
    currentSessionKey: string;
    delivery: SessionHistoryDeliveryOutput;
}) {
    return <DeliveryCard currentSessionKey={currentSessionKey} delivery={delivery} />;
}
