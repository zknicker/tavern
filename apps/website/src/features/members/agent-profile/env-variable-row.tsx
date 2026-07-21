import { Cancel01Icon, Plus } from '@hugeicons/core-free-icons';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SecretInput } from '../../../components/ui/secret-input.tsx';

interface EnvVariableRowProps {
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
}

export function EnvVariableRow({
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
}: EnvVariableRowProps) {
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

interface NewEnvVariableRowProps {
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
}

export function NewEnvVariableRow({
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
}: NewEnvVariableRowProps) {
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
