import { Cancel01Icon, Plus } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SecretInput } from '../../../components/ui/secret-input.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';

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
            title="Environment"
        >
            <SettingsGroup>
                <SettingsItem className="space-y-3 ps-5 pe-3.5">
                    <div className="grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(16rem,17rem)] md:items-center md:gap-6">
                        <div className="min-w-0 space-y-0.5">
                            <h3 className="font-medium text-foreground text-sm leading-tight">
                                Agent env vars
                            </h3>
                            <p className="text-meta text-muted-foreground leading-tight">
                                Available after restart.
                            </p>
                        </div>
                        {hasEnvRows ? null : (
                            <p className="text-left text-muted-foreground text-sm md:text-left">
                                No agent env vars saved.
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

function EnvVariableRow({
    canSave,
    disabled,
    isSaving,
    name,
    onRemove,
    onRevealToggle,
    onSave,
    onValueChange,
    revealed,
    value,
}: {
    canSave: boolean;
    disabled: boolean;
    isSaving: boolean;
    name: string;
    onRemove: () => void;
    onRevealToggle: () => void;
    onSave: () => void;
    onValueChange: (value: string) => void;
    revealed: boolean;
    value: string;
}) {
    return (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto_auto]">
            <Input
                aria-label={`${name} name`}
                className="font-mono"
                name={`agent-env-name-${name}`}
                nativeInput
                readOnly
                value={name}
            />
            <SecretInput
                ariaLabel={`${name} value`}
                disabled={disabled}
                name={`agent-env-${name}`}
                onChange={onValueChange}
                onRevealToggle={onRevealToggle}
                revealed={revealed}
                value={value}
            />
            <Button disabled={!canSave} loading={isSaving} onClick={onSave} variant="secondary">
                Save
            </Button>
            <Button
                aria-label={`Remove ${name}`}
                disabled={disabled}
                loading={isSaving}
                onClick={onRemove}
                size="icon"
                variant="ghost"
            >
                <Icon icon={Cancel01Icon} />
            </Button>
        </div>
    );
}

function NewEnvVariableRow({
    canAdd,
    disabled,
    draftName,
    draftValue,
    isSaving,
    onAdd,
    onCancel,
    onNameChange,
    onRevealToggle,
    onValueChange,
    revealed,
}: {
    canAdd: boolean;
    disabled: boolean;
    draftName: string;
    draftValue: string;
    isSaving: boolean;
    onAdd: () => void;
    onCancel: () => void;
    onNameChange: (value: string) => void;
    onRevealToggle: () => void;
    onValueChange: (value: string) => void;
    revealed: boolean;
}) {
    return (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto_auto]">
            <Input
                aria-label="Env var name"
                autoCapitalize="characters"
                disabled={disabled}
                name="agent-env-name"
                nativeInput
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="NAME"
                value={draftName}
            />
            <SecretInput
                ariaLabel="New env var value"
                disabled={disabled}
                name="agent-env-value"
                onChange={onValueChange}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && canAdd) {
                        event.preventDefault();
                        onAdd();
                    }
                }}
                onRevealToggle={onRevealToggle}
                placeholder="Value"
                revealed={revealed}
                value={draftValue}
            />
            <Button disabled={!canAdd} loading={isSaving} onClick={onAdd} variant="secondary">
                <Icon icon={Plus} />
                Add
            </Button>
            <Button
                aria-label="Cancel new env var"
                disabled={disabled}
                onClick={onCancel}
                size="icon"
                variant="ghost"
            >
                <Icon icon={Cancel01Icon} />
            </Button>
        </div>
    );
}
