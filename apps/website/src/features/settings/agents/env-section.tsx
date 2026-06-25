import { Cancel01Icon, Plus } from '@hugeicons/core-free-icons';
import { Fragment, useState } from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SecretInput } from '../../../components/ui/secret-input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';

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

    const rows = [
        ...(variables.length === 0 && !isAdding
            ? [
                  {
                      content: (
                          <SettingsRow
                              className="md:grid-cols-[minmax(10rem,1fr)_minmax(18rem,42rem)]"
                              description="Secrets and flags available to the managed agent after restart."
                              title="Agent env vars"
                          >
                              <p className="text-muted-foreground text-sm">
                                  No agent env vars saved.
                              </p>
                          </SettingsRow>
                      ),
                      key: 'empty',
                  },
              ]
            : []),
        ...variables.map((variable) => {
            const persistedValue = variable.value ?? '';
            const hasReplacementDraft = Object.hasOwn(replacementDrafts, variable.name);
            const replacementValue = replacementDrafts[variable.name] ?? '';
            const fieldValue = hasReplacementDraft ? replacementValue : persistedValue;
            const canSave =
                !disabled &&
                hasReplacementDraft &&
                replacementValue.length > 0 &&
                replacementValue !== persistedValue;

            return {
                content: (
                    <SettingsRow
                        className="md:grid-cols-[minmax(10rem,1fr)_minmax(20rem,42rem)]"
                        description="Available after agent restart."
                        title={
                            <span className="block min-w-0 break-all font-mono text-foreground text-sm">
                                {variable.name}
                            </span>
                        }
                    >
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                            <SecretInput
                                ariaLabel={`${variable.name} value`}
                                disabled={disabled}
                                name={`agent-env-${variable.name}`}
                                onChange={(value) =>
                                    setReplacementDrafts((drafts) => ({
                                        ...drafts,
                                        [variable.name]: value,
                                    }))
                                }
                                onRevealToggle={() => toggleReveal(variable.name)}
                                revealed={Boolean(revealedValues[variable.name])}
                                value={fieldValue}
                            />
                            <Button
                                disabled={!canSave}
                                loading={isSaving}
                                onClick={() =>
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
                                            .filter((entry) => entry.name !== variable.name)
                                            .map((entry) => ({ name: entry.name }))
                                    )
                                }
                                size="icon-sm"
                                variant="ghost"
                            >
                                <Icon icon={Cancel01Icon} />
                            </Button>
                        </div>
                    </SettingsRow>
                ),
                key: variable.name,
            };
        }),
        ...(isAdding
            ? [
                  {
                      content: (
                          <SettingsRow
                              className="md:grid-cols-[minmax(10rem,1fr)_minmax(20rem,42rem)]"
                              description="Use shell-style names like GITHUB_TOKEN."
                              title="New env var"
                          >
                              <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto_auto]">
                                  <Input
                                      aria-label="Env var name"
                                      autoCapitalize="characters"
                                      disabled={disabled}
                                      name="agent-env-name"
                                      nativeInput
                                      onChange={(event) => setDraftName(event.target.value)}
                                      placeholder="NAME"
                                      value={draftName}
                                  />
                                  <SecretInput
                                      ariaLabel="New env var value"
                                      disabled={disabled}
                                      name="agent-env-value"
                                      onChange={setDraftValue}
                                      onKeyDown={(event) => {
                                          if (event.key === 'Enter' && canAdd) {
                                              event.preventDefault();
                                              void addVariable();
                                          }
                                      }}
                                      onRevealToggle={() =>
                                          setIsDraftValueRevealed((revealed) => !revealed)
                                      }
                                      placeholder="Value"
                                      revealed={isDraftValueRevealed}
                                      value={draftValue}
                                  />
                                  <Button
                                      disabled={!canAdd}
                                      loading={isSaving}
                                      onClick={() => void addVariable()}
                                      size="sm"
                                      variant="outline"
                                  >
                                      <Icon icon={Plus} />
                                      Add
                                  </Button>
                                  <Button
                                      aria-label="Cancel new env var"
                                      disabled={disabled}
                                      onClick={closeAddRow}
                                      size="icon-sm"
                                      variant="ghost"
                                  >
                                      <Icon icon={Cancel01Icon} />
                                  </Button>
                              </div>
                          </SettingsRow>
                      ),
                      key: 'add',
                  },
              ]
            : []),
    ];

    return (
        <section>
            <BadgeDivider
                action={
                    <Button
                        aria-expanded={isAdding}
                        disabled={disabled || isAdding}
                        onClick={() => setIsAdding(true)}
                        size="sm"
                        variant="secondary"
                    >
                        <Icon icon={Plus} />
                        Add env var
                    </Button>
                }
                className="pb-4"
            >
                Environment
            </BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    {rows.map((row, index) => (
                        <Fragment key={row.key}>
                            {index > 0 ? <Separator /> : null}
                            {row.content}
                        </Fragment>
                    ))}
                </Card>
            </CardFrame>
        </section>
    );
}
