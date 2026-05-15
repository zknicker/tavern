import type { CronEditorFormApi } from '../use-cron-editor-form.ts';
import { CronSelectRow } from './cron-select-field.tsx';
import type { CronEditorSelectOption } from './use-cron-editor-options.ts';

const noDeliveryValue = '__none__';

interface CronDeliveryFieldsProps {
    deliveryChatOptions: CronEditorSelectOption[];
    form: CronEditorFormApi;
}

export function CronDeliveryFields({ deliveryChatOptions, form }: CronDeliveryFieldsProps) {
    return (
        <form.Field name="deliveryChatId">
            {(field) => (
                <CronSelectRow
                    label="Delivery chat"
                    onValueChange={(value) =>
                        field.handleChange(value === noDeliveryValue ? '' : value)
                    }
                    options={[
                        {
                            label: 'No delivery chat',
                            value: noDeliveryValue,
                        },
                        ...deliveryChatOptions,
                    ]}
                    placeholder="Select a synced chat"
                    size="sm"
                    value={field.state.value || noDeliveryValue}
                />
            )}
        </form.Field>
    );
}
