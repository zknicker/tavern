import { Fragment, useState } from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsActionRow, SettingsRow } from '../../../components/ui/settings-row.tsx';
import { toastManager } from '../../../components/ui/toast.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { ConnectorFormDrawer } from './connector-form.tsx';
import { type Connector, connectorSummary } from './connector-shared.ts';
import { useConnectors } from './use-connectors.ts';

type ConnectorEditorState = { mode: 'create' } | { connector: Connector; mode: 'edit' } | null;

export function ConnectorsSettingsPage() {
    const connectors = useConnectors();
    const [editor, setEditor] = useState<ConnectorEditorState>(null);
    const editing = editor?.mode === 'edit' ? editor.connector : null;

    const runTest = (connector: Connector) => {
        void connectors
            .testConnector({ id: connector.id })
            .then((result) =>
                toastManager.add({
                    description: result.message,
                    title: result.ok
                        ? `${connector.name} looks good`
                        : `${connector.name} test failed`,
                    type: result.ok ? 'success' : 'error',
                })
            )
            .catch((error: unknown) =>
                toastManager.add({
                    description: error instanceof Error ? error.message : 'Try again.',
                    priority: 'high',
                    title: 'Test failed',
                    type: 'error',
                })
            );
    };

    return (
        <section>
            <BadgeDivider className="pb-4">Connectors</BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    {connectors.connectors.length === 0 ? (
                        <p className="px-5 py-4 text-muted-foreground text-sm">
                            {connectors.isLoading
                                ? 'Loading connectors...'
                                : 'No connectors yet. Add an MCP server to give the agent new tools.'}
                        </p>
                    ) : null}

                    {connectors.connectors.map((connector) => (
                        <Fragment key={connector.id}>
                            <SettingsRow
                                description={
                                    <span className="block truncate font-mono text-xs">
                                        {connectorSummary(connector)}
                                    </span>
                                }
                                title={connector.name}
                                trailingWidth="intrinsic"
                            >
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        disabled={connectors.isSaving}
                                        loading={connectors.testingId === connector.id}
                                        onClick={() => runTest(connector)}
                                        size="sm"
                                        variant="outline"
                                    >
                                        Test
                                    </Button>
                                    <Button
                                        disabled={connectors.isSaving}
                                        onClick={() => setEditor({ connector, mode: 'edit' })}
                                        size="sm"
                                        variant="outline"
                                    >
                                        Edit
                                    </Button>
                                    <DeleteConnectorButton
                                        disabled={connectors.isSaving}
                                        onDelete={() =>
                                            void withSavingToast(() =>
                                                connectors.deleteConnector({ id: connector.id })
                                            ).catch(() => undefined)
                                        }
                                    />
                                </div>
                            </SettingsRow>
                            <Separator />
                        </Fragment>
                    ))}

                    <SettingsActionRow onClick={() => setEditor({ mode: 'create' })}>
                        Add connector
                    </SettingsActionRow>
                </Card>
            </CardFrame>

            {editor ? (
                <ConnectorFormDrawer
                    connector={editing}
                    key={editing?.id ?? 'create'}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditor(null);
                        }
                    }}
                    onSave={(input) =>
                        void withSavingToast(() =>
                            editing
                                ? connectors.updateConnector({ connector: input, id: editing.id })
                                : connectors.createConnector(input)
                        )
                            .then(() => setEditor(null))
                            .catch(() => undefined)
                    }
                    open
                    saving={connectors.isSaving}
                />
            ) : null}
        </section>
    );
}

function DeleteConnectorButton({
    disabled,
    onDelete,
}: {
    disabled: boolean;
    onDelete: () => void;
}) {
    const [confirming, setConfirming] = useState(false);

    if (confirming) {
        return (
            <Button
                disabled={disabled}
                onBlur={() => setConfirming(false)}
                onClick={onDelete}
                size="sm"
                variant="destructive"
            >
                Confirm
            </Button>
        );
    }

    return (
        <Button disabled={disabled} onClick={() => setConfirming(true)} size="sm" variant="ghost">
            Delete
        </Button>
    );
}
