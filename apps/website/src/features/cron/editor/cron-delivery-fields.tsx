import type { CronEditorFormApi } from '../use-cron-editor-form.ts';
import { CronSelectRow } from './cron-select-field.tsx';
import type { CronEditorSelectOption } from './use-cron-editor-options.ts';

interface CronDeliveryFieldsProps {
    agentId: string;
    deliveryChatOptions: CronEditorSelectOption[];
    form: CronEditorFormApi;
}

export function CronDeliveryFields({
    agentId,
    deliveryChatOptions,
    form,
}: CronDeliveryFieldsProps) {
    const hasAgent = agentId.trim().length > 0;

    return (
        <form.Field name="deliveryChatId">
            {(field) => (
                <CronSelectRow
                    emptyText={hasAgent ? 'No chats for this agent' : 'Choose an agent first'}
                    label="Delivery chat"
                    onValueChange={field.handleChange}
                    options={hasAgent ? deliveryChatOptions : []}
                    placeholder="Select a synced chat"
                    size="sm"
                    value={field.state.value}
                />
            )}
        </form.Field>
    );
}
