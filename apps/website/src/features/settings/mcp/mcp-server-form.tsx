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
import type { McpServerSaveInput } from '../../../lib/trpc.tsx';
import { SecretFieldsEditor } from './mcp-secret-fields.tsx';
import {
    buildSaveInput,
    createMcpServerDraft,
    type McpServer,
    type McpServerTransport,
} from './mcp-server-shared.ts';

const transportLabels: Record<McpServerTransport, string> = {
    http: 'HTTP',
    stdio: 'stdio',
};

export function McpServerFormDrawer({
    server,
    onOpenChange,
    onSave,
    open,
    saving,
}: {
    server: McpServer | null;
    onOpenChange: (open: boolean) => void;
    onSave: (input: McpServerSaveInput) => void;
    open: boolean;
    saving: boolean;
}) {
    const [draft, setDraft] = useState(() => createMcpServerDraft(server));
    const canSave = Boolean(
        draft.name.trim() && (draft.transport === 'stdio' ? draft.command.trim() : draft.url.trim())
    );

    return (
        <Drawer onOpenChange={onOpenChange} open={open} position="right">
            <DrawerPopup className="max-w-[600px] sm:w-[600px]" showCloseButton variant="inset">
                <Form
                    className="flex min-h-0 flex-1 flex-col gap-0"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (canSave) {
                            onSave(buildSaveInput(draft));
                        }
                    }}
                >
                    <DrawerHeader>
                        <DrawerTitle>{server ? 'Edit MCP server' : 'Add MCP server'}</DrawerTitle>
                    </DrawerHeader>
                    <DrawerPanel className="grid gap-6">
                        <McpServerField label="Name">
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
                        </McpServerField>

                        <McpServerField label="Transport">
                            <Select
                                onValueChange={(value) =>
                                    setDraft((current) => ({
                                        ...current,
                                        transport: value === 'http' ? 'http' : 'stdio',
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
                        </McpServerField>

                        {draft.transport === 'stdio' ? (
                            <>
                                <McpServerField label="Command">
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
                                </McpServerField>
                                <McpServerField
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
                                        placeholder="--flag value"
                                        value={draft.args}
                                    />
                                </McpServerField>
                            </>
                        ) : (
                            <McpServerField label="URL">
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
                            </McpServerField>
                        )}

                        <SecretFieldsEditor
                            addLabel="Add variable"
                            entries={draft.env}
                            onChange={(env) => setDraft((current) => ({ ...current, env }))}
                            title="Environment variables"
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
                            {server ? 'Save MCP server' : 'Add MCP server'}
                        </Button>
                    </DrawerFooter>
                </Form>
            </DrawerPopup>
        </Drawer>
    );
}

function McpServerField({
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
