import { Cancel01Icon, Plus } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';

export interface AgentEnvVariable {
    hasValue: boolean;
    name: string;
}

const envNamePattern = /^[A-Z_][A-Z0-9_]*$/u;

export function AgentEnvSection({
    disabled,
    isSaving,
    onChange,
    variables,
}: {
    disabled: boolean;
    isSaving: boolean;
    onChange: (next: { variables: { name: string; value?: string }[] }) => Promise<unknown>;
    variables: AgentEnvVariable[];
}) {
    const [draftName, setDraftName] = useState('');
    const [draftValue, setDraftValue] = useState('');
    const [replacementDrafts, setReplacementDrafts] = useState<Record<string, string>>({});

    const saveVariables = async (next: { name: string; value?: string }[]) => {
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
        setDraftName('');
        setDraftValue('');
    };

    return (
        <section>
            <BadgeDivider className="pb-4">Environment</BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow
                        description="Secrets and flags available to the managed agent after restart."
                        title="Agent env vars"
                    >
                        <div className="flex flex-col gap-3">
                            {variables.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No agent env vars saved.
                                </p>
                            ) : (
                                variables.map((variable, index) => (
                                    <div className="flex flex-col gap-2" key={variable.name}>
                                        {index > 0 ? <Separator /> : null}
                                        <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto_auto]">
                                            <Input disabled nativeInput value={variable.name} />
                                            <Input
                                                disabled={disabled}
                                                nativeInput
                                                onChange={(event) =>
                                                    setReplacementDrafts((drafts) => ({
                                                        ...drafts,
                                                        [variable.name]: event.target.value,
                                                    }))
                                                }
                                                placeholder={
                                                    variable.hasValue ? 'Saved value' : 'New value'
                                                }
                                                type="password"
                                                value={replacementDrafts[variable.name] ?? ''}
                                            />
                                            <Button
                                                disabled={
                                                    disabled || !replacementDrafts[variable.name]
                                                }
                                                loading={isSaving}
                                                onClick={() =>
                                                    void saveVariables(
                                                        variables.map((entry) => ({
                                                            name: entry.name,
                                                            value:
                                                                entry.name === variable.name
                                                                    ? replacementDrafts[
                                                                          variable.name
                                                                      ]
                                                                    : undefined,
                                                        }))
                                                    )
                                                }
                                                size="sm"
                                                variant="outline"
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                aria-label={`Remove ${variable.name}`}
                                                disabled={disabled}
                                                loading={isSaving}
                                                onClick={() =>
                                                    void saveVariables(
                                                        variables
                                                            .filter(
                                                                (entry) =>
                                                                    entry.name !== variable.name
                                                            )
                                                            .map((entry) => ({ name: entry.name }))
                                                    )
                                                }
                                                size="icon-sm"
                                                variant="ghost"
                                            >
                                                <Icon icon={Cancel01Icon} />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </SettingsRow>

                    <Separator />

                    <SettingsRow
                        description="Use shell-style names like GITHUB_TOKEN."
                        title="Add env var"
                    >
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto]">
                            <Input
                                autoCapitalize="characters"
                                disabled={disabled}
                                nativeInput
                                onChange={(event) => setDraftName(event.target.value)}
                                placeholder="NAME"
                                value={draftName}
                            />
                            <Input
                                disabled={disabled}
                                nativeInput
                                onChange={(event) => setDraftValue(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void addVariable();
                                    }
                                }}
                                placeholder="Value"
                                type="password"
                                value={draftValue}
                            />
                            <Button
                                disabled={
                                    disabled ||
                                    !(draftName.trim() && draftValue) ||
                                    !envNamePattern.test(draftName.trim().toUpperCase())
                                }
                                loading={isSaving}
                                onClick={() => void addVariable()}
                                size="sm"
                                variant="outline"
                            >
                                <Icon icon={Plus} />
                                Add
                            </Button>
                        </div>
                    </SettingsRow>
                </Card>
            </CardFrame>
        </section>
    );
}
