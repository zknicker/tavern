import * as React from 'react';
import { useCronDeliveryTargets } from '../../../hooks/cron/use-cron-delivery-targets.ts';

export interface CronEditorSelectOption {
    label: string;
    value: string;
}

interface DeliveryTargetOptionInput {
    chatId: string;
    label: string;
    platform: string;
}

function disambiguateOptionLabels(options: CronEditorSelectOption[]) {
    const counts = new Map<string, number>();

    for (const option of options) {
        counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
    }

    return options.map((option) => {
        if ((counts.get(option.label) ?? 0) < 2) {
            return option;
        }

        return {
            ...option,
            label: `${option.label} · ${option.value}`,
        };
    });
}

export function buildDeliveryChatOptions(
    targets: DeliveryTargetOptionInput[],
    currentDeliveryChatId = ''
) {
    const seen = new Set<string>();
    const options: CronEditorSelectOption[] = [];

    for (const target of targets) {
        if (seen.has(target.chatId)) {
            continue;
        }

        seen.add(target.chatId);
        options.push({
            label: target.label,
            value: target.chatId,
        });
    }

    if (currentDeliveryChatId.trim() && !seen.has(currentDeliveryChatId)) {
        options.unshift({
            label: currentDeliveryChatId,
            value: currentDeliveryChatId,
        });
    }

    return disambiguateOptionLabels(options);
}

export function useCronEditorOptions(input: { agentId: string; currentDeliveryChatId: string }) {
    const deliveryTargets = useCronDeliveryTargets(input.agentId.trim() || null);

    return React.useMemo(
        () => ({
            deliveryChatOptions: buildDeliveryChatOptions(
                deliveryTargets.data?.targets ?? [],
                input.currentDeliveryChatId
            ),
        }),
        [deliveryTargets.data?.targets, input.currentDeliveryChatId]
    );
}
