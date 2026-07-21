import { Plus } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { EnvVariableRow, NewEnvVariableRow } from './env-variable-row.tsx';

export interface AgentEnvVariable {
    hasValue: boolean;
    name: string;
    value?: string;
}

const envNamePattern = /^[A-Z_][A-Z0-9_]*$/u;

interface SaveAgentEnvVariable {
    name: string;
    value?: string;
}

export function AgentEnvSection({
    disabled,
    isSaving,
    onChange,
    variables,
}: {
    disabled: boolean;
    isSaving: boolean;
    onChange: (next: { variables: SaveAgentEnvVariable[] }) => Promise<unknown>;
    variables: AgentEnvVariable[];
}) {
    const [isAdding, setIsAdding] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [draftValue, setDraftValue] = useState('');
    const [replacementDrafts, setReplacementDrafts] = useState<Record<string, string>>({});
    const [revealedValues, setRevealedValues] = useState<Record<string, boolean>>({});
    const [isDraftValueRevealed, setIsDraftValueRevealed] = useState(false);

    const saveVariables = async (next: SaveAgentEnvVariable[]) => {
        await onChange({ variables: next });
        setReplacementDrafts({});
    };

    const addVariable = async () => {
        const name = draftName.trim().toUpperCase();
        const value = draftValue;

        if (!(name && value && envNamePattern.test(name))) {
            return;
        }

        const existing = variables
            .filter((entry) => entry.name !== name)
            .map((entry) => ({ name: entry.name }));
        await saveVariables([...existing, { name, value }]);
        closeAddRow();
    };

    const closeAddRow = () => {
        setIsAdding(false);
        setDraftName('');
        setDraftValue('');
        setIsDraftValueRevealed(false);
    };

    const toggleReveal = (name: string) => {
        setRevealedValues((current) => ({ ...current, [name]: !current[name] }));
    };

    const normalizedDraftName = draftName.trim().toUpperCase();
    const canAdd =
        !disabled &&
        Boolean(normalizedDraftName && draftValue && envNamePattern.test(normalizedDraftName));

    const hasEnvRows = variables.length > 0 || isAdding;

    return (
        <SettingsSection
            action={
                isAdding ? null : (
                    <Button
                        aria-expanded={isAdding}
                        disabled={disabled}
                        onClick={() => setIsAdding(true)}
                        variant="secondary"
                    >
                        <Icon icon={Plus} />
                        Add env var
                    </Button>
                )
            }
            title="Runtime environment"
        >
            <SettingsGroup>
                <SettingsItem className="space-y-3 ps-5 pe-3.5">
                    <div className="grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(16rem,17rem)] md:items-center md:gap-6">
                        <div className="min-w-0 space-y-0.5">
                            <h3 className="font-medium text-foreground text-sm leading-tight">
                                Runtime env vars
                            </h3>
                            <p className="text-meta text-muted-foreground leading-tight">
                                Available after restart.
                            </p>
                        </div>
                        {hasEnvRows ? null : (
                            <p className="text-left text-muted-foreground text-sm md:text-left">
                                No runtime env vars saved.
                            </p>
                        )}
                    </div>

                    {hasEnvRows ? (
                        <div className="grid gap-2">
                            {variables.map((variable) => {
                                const persistedValue = variable.value ?? '';
                                const hasReplacementDraft = Object.hasOwn(
                                    replacementDrafts,
                                    variable.name
                                );
                                const replacementValue = replacementDrafts[variable.name] ?? '';
                                const fieldValue = hasReplacementDraft
                                    ? replacementValue
                                    : persistedValue;
                                const canSave =
                                    !disabled &&
                                    hasReplacementDraft &&
                                    replacementValue.length > 0 &&
                                    replacementValue !== persistedValue;

                                return (
                                    <EnvVariableRow
                                        canSave={canSave}
                                        disabled={disabled}
                                        isSaving={isSaving}
                                        key={variable.name}
                                        name={variable.name}
                                        onRemove={() =>
                                            void saveVariables(
                                                variables
                                                    .filter((entry) => entry.name !== variable.name)
                                                    .map((entry) => ({ name: entry.name }))
                                            )
                                        }
                                        onRevealToggle={() => toggleReveal(variable.name)}
                                        onSave={() =>
                                            void saveVariables(
                                                variables.map((entry) => ({
                                                    name: entry.name,
                                                    value:
                                                        entry.name === variable.name
                                                            ? replacementValue
                                                            : undefined,
                                                }))
                                            )
                                        }
                                        onValueChange={(value) =>
                                            setReplacementDrafts((drafts) => ({
                                                ...drafts,
                                                [variable.name]: value,
                                            }))
                                        }
                                        revealed={Boolean(revealedValues[variable.name])}
                                        value={fieldValue}
                                    />
                                );
                            })}

                            {isAdding ? (
                                <NewEnvVariableRow
                                    canAdd={canAdd}
                                    disabled={disabled}
                                    draftName={draftName}
                                    draftValue={draftValue}
                                    isSaving={isSaving}
                                    onAdd={() => void addVariable()}
                                    onCancel={closeAddRow}
                                    onNameChange={setDraftName}
                                    onRevealToggle={() =>
                                        setIsDraftValueRevealed((revealed) => !revealed)
                                    }
                                    onValueChange={setDraftValue}
                                    revealed={isDraftValueRevealed}
                                />
                            ) : null}
                        </div>
                    ) : null}
                </SettingsItem>
            </SettingsGroup>
        </SettingsSection>
    );
}
