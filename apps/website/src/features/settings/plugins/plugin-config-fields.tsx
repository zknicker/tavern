import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useState } from 'react';
import { FieldError } from '../../../components/ui/primitives/field.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SecretInput } from '../../../components/ui/secret-input.tsx';
import { PluginField, PluginFieldRow } from './plugin-dialog.tsx';

export interface PluginConfigField<TDraft> {
    ariaLabel: string;
    description?: ReactNode;
    error?: ReactNode;
    id: string;
    kind: 'secret' | 'text';
    label: ReactNode;
    monospace?: boolean;
    name?: string;
    placeholder?: string;
    read: (draft: TDraft) => string;
    write: (draft: TDraft, value: string) => TDraft;
}

export function PluginConfigFields<TDraft>({
    disabled,
    draft,
    fields,
    onDraftChange,
}: {
    disabled: boolean;
    draft: TDraft;
    fields: readonly PluginConfigField<TDraft>[];
    onDraftChange: Dispatch<SetStateAction<TDraft>>;
}) {
    const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

    return (
        <>
            {fields.map((field) => (
                <PluginField description={field.description} key={field.id} label={field.label}>
                    {field.kind === 'secret' ? (
                        <SecretInput
                            ariaLabel={field.ariaLabel}
                            disabled={disabled}
                            name={field.name ?? field.id}
                            onChange={(value) =>
                                onDraftChange((current) => field.write(current, value))
                            }
                            onRevealToggle={() =>
                                setRevealedSecrets((current) => ({
                                    ...current,
                                    [field.id]: !current[field.id],
                                }))
                            }
                            placeholder={field.placeholder}
                            revealed={Boolean(revealedSecrets[field.id])}
                            value={field.read(draft)}
                        />
                    ) : (
                        <Input
                            aria-label={field.ariaLabel}
                            autoComplete="off"
                            className={field.monospace ? 'font-mono' : undefined}
                            disabled={disabled}
                            onChange={(event) =>
                                onDraftChange((current) =>
                                    field.write(current, event.currentTarget.value)
                                )
                            }
                            placeholder={field.placeholder}
                            value={field.read(draft)}
                        />
                    )}
                    {field.error ? <FieldError>{field.error}</FieldError> : null}
                </PluginField>
            ))}
        </>
    );
}

export function PluginConfigFieldRow<TDraft>({
    disabled,
    draft,
    fields,
    onDraftChange,
}: {
    disabled: boolean;
    draft: TDraft;
    fields: readonly PluginConfigField<TDraft>[];
    onDraftChange: Dispatch<SetStateAction<TDraft>>;
}) {
    return (
        <PluginFieldRow>
            <PluginConfigFields
                disabled={disabled}
                draft={draft}
                fields={fields}
                onDraftChange={onDraftChange}
            />
        </PluginFieldRow>
    );
}
