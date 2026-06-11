import type * as React from 'react';
import { useState } from 'react';
import {
    Drawer,
    DrawerFooter,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../../components/ui/drawer.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Form } from '../../../components/ui/primitives/form.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import type { ConnectorSaveInput } from '../../../lib/trpc.tsx';
import { SecretFieldsEditor } from './connector-secret-fields.tsx';
import {
    buildSaveInput,
    type Connector,
    type ConnectorTransport,
    createConnectorDraft,
} from './connector-shared.ts';

const transportLabels: Record<ConnectorTransport, string> = {
    command: 'Command',
    url: 'URL',
};

export function ConnectorFormDrawer({
    connector,
    onOpenChange,
    onSave,
    open,
    saving,
}: {
    connector: Connector | null;
    onOpenChange: (open: boolean) => void;
    onSave: (input: ConnectorSaveInput) => void;
    open: boolean;
    saving: boolean;
}) {
    const [draft, setDraft] = useState(() => createConnectorDraft(connector));
    const canSave = Boolean(
        draft.name.trim() &&
            (draft.transport === 'command' ? draft.command.trim() : draft.url.trim())
    );

    return (
        <Drawer onOpenChange={onOpenChange} open={open} position="right">
            <DrawerPopup className="max-w-[600px] sm:w-[600px]" showCloseButton variant="inset">
                <Form
                    className="flex min-h-0 flex-1 flex-col gap-0"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (canSave) {
                            onSave(buildSaveInput(draft, connector));
                        }
                    }}
                >
                    <DrawerHeader>
                        <DrawerTitle>{connector ? 'Edit connector' : 'Add connector'}</DrawerTitle>
                    </DrawerHeader>
                    <DrawerPanel className="grid gap-6">
                        <ConnectorField label="Name">
                            <Input
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                                placeholder="GitHub"
                                value={draft.name}
                            />
                        </ConnectorField>

                        <ConnectorField label="Transport">
                            <Select
                                onValueChange={(value) =>
                                    setDraft((current) => ({
                                        ...current,
                                        transport: value === 'url' ? 'url' : 'command',
                                    }))
                                }
                                value={draft.transport}
                            >
                                <SelectTrigger>
                                    <SelectValue>{transportLabels[draft.transport]}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(transportLabels).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </ConnectorField>

                        {draft.transport === 'command' ? (
                            <>
                                <ConnectorField label="Command">
                                    <Input
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                command: event.target.value,
                                            }))
                                        }
                                        placeholder="mcp-server"
                                        value={draft.command}
                                    />
                                </ConnectorField>
                                <ConnectorField
                                    description="Separate arguments with spaces."
                                    label="Arguments"
                                >
                                    <Input
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                args: event.target.value,
                                            }))
                                        }
                                        placeholder="mcp-server --flag"
                                        value={draft.args}
                                    />
                                </ConnectorField>
                            </>
                        ) : (
                            <ConnectorField label="URL">
                                <Input
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            url: event.target.value,
                                        }))
                                    }
                                    placeholder="https://example.com/mcp"
                                    value={draft.url}
                                />
                            </ConnectorField>
                        )}

                        <ConnectorField
                            description="Optional. How long to wait for the MCP server."
                            label="Timeout seconds"
                        >
                            <Input
                                min={1}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        timeoutSeconds: event.target.value,
                                    }))
                                }
                                placeholder="Default"
                                type="number"
                                value={draft.timeoutSeconds}
                            />
                        </ConnectorField>

                        <SecretFieldsEditor
                            addLabel="Add variable"
                            entries={draft.env}
                            onChange={(env) => setDraft((current) => ({ ...current, env }))}
                            saved={connector?.env ?? []}
                            title="Environment variables"
                        />

                        <SecretFieldsEditor
                            addLabel="Add header"
                            entries={draft.headers}
                            onChange={(headers) => setDraft((current) => ({ ...current, headers }))}
                            saved={connector?.headers ?? []}
                            title="Headers"
                        />
                    </DrawerPanel>
                    <DrawerFooter>
                        <Button
                            onClick={() => onOpenChange(false)}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        <Button disabled={!canSave} loading={saving} type="submit">
                            {connector ? 'Save connector' : 'Add connector'}
                        </Button>
                    </DrawerFooter>
                </Form>
            </DrawerPopup>
        </Drawer>
    );
}

function ConnectorField({
    children,
    description,
    label,
}: {
    children: React.ReactNode;
    description?: string;
    label: string;
}) {
    return (
        <label className="grid gap-1.5">
            <span className="font-medium text-foreground text-sm">{label}</span>
            {children}
            {description ? (
                <span className="text-muted-foreground text-xs">{description}</span>
            ) : null}
        </label>
    );
}
