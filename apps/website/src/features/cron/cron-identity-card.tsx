import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Card } from '../../components/ui/card.tsx';
import { Field, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import type { CronEditorFormApi } from './use-cron-editor-form.ts';

interface CronIdentityCardProps {
    form: CronEditorFormApi;
}

export function CronIdentityCard({ form }: CronIdentityCardProps) {
    return (
        <Card className="overflow-hidden">
            <BadgeDivider className="px-4 pt-5 pb-4" subtext="Name and describe this reminder.">
                Identity
            </BadgeDivider>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
                <form.Field name="name">
                    {(field) => (
                        <Field>
                            <FieldLabel>Name</FieldLabel>
                            <Input
                                onBlur={field.handleBlur}
                                onChange={(event) => field.handleChange(event.target.value)}
                                value={field.state.value}
                            />
                        </Field>
                    )}
                </form.Field>
                <form.Field name="description">
                    {(field) => (
                        <Field>
                            <FieldLabel>Description</FieldLabel>
                            <Input
                                onBlur={field.handleBlur}
                                onChange={(event) => field.handleChange(event.target.value)}
                                value={field.state.value}
                            />
                        </Field>
                    )}
                </form.Field>
            </div>
        </Card>
    );
}
