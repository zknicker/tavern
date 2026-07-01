import { Fragment, useState } from 'react';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsActionRow,
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { toastManager } from '../../../components/ui/toast.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { McpServerFormDrawer } from './mcp-server-form.tsx';
import { type McpServer, mcpServerSummary } from './mcp-server-shared.ts';
import { useMcpServers } from './use-mcp-servers.ts';

export function McpSettingsPage() {
    const servers = useMcpServers();
    const [isAddOpen, setIsAddOpen] = useState(false);

    const runTest = (server: McpServer) => {
        void servers
            .testMcpServer({ name: server.name })
            .then((result) =>
                toastManager.add({
                    description: result.error ?? `${result.tools.length} tools available.`,
                    title: result.ok ? `${server.name} looks good` : `${server.name} test failed`,
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
        <SettingsPage>
            <SettingsPageHeader title="MCP" />
            <SettingsSection title="Advanced MCP">
                <SettingsGroup>
                    {servers.mcpServers.length === 0 ? (
                        <p className="px-5 py-4 text-muted-foreground text-sm">
                            {servers.isLoading
                                ? 'Loading MCP servers...'
                                : 'No MCP servers configured. Add one only when a Plugin or runtime experiment needs an MCP-backed tool source.'}
                        </p>
                    ) : null}

                    {servers.mcpServers.map((server) => (
                        <Fragment key={server.name}>
                            <SettingsRow
                                description={
                                    <span className="block truncate font-mono text-xs">
                                        {mcpServerSummary(server)}
                                    </span>
                                }
                                title={server.name}
                                trailingWidth="intrinsic"
                            >
                                <div className="flex items-center gap-1.5">
                                    <Switch
                                        aria-label={`${server.name} enabled`}
                                        checked={server.enabled}
                                        disabled={servers.isSaving}
                                        onCheckedChange={(enabled) =>
                                            void withSavingToast(() =>
                                                servers.setMcpServerEnabled({
                                                    enabled,
                                                    name: server.name,
                                                })
                                            ).catch(() => undefined)
                                        }
                                    />
                                    <Button
                                        disabled={servers.isSaving}
                                        loading={servers.testingName === server.name}
                                        onClick={() => runTest(server)}
                                        variant="outline"
                                    >
                                        Test
                                    </Button>
                                    <DeleteMcpServerButton
                                        disabled={servers.isSaving}
                                        onDelete={() =>
                                            void withSavingToast(() =>
                                                servers.removeMcpServer({ name: server.name })
                                            ).catch(() => undefined)
                                        }
                                    />
                                </div>
                            </SettingsRow>
                            <Separator />
                        </Fragment>
                    ))}

                    <SettingsActionRow onClick={() => setIsAddOpen(true)}>
                        Add MCP server
                    </SettingsActionRow>
                </SettingsGroup>
            </SettingsSection>

            {isAddOpen ? (
                <McpServerFormDrawer
                    onOpenChange={setIsAddOpen}
                    onSave={(input) =>
                        void withSavingToast(() => servers.addMcpServer(input))
                            .then(() => setIsAddOpen(false))
                            .catch(() => undefined)
                    }
                    open
                    saving={servers.isSaving}
                    server={null}
                />
            ) : null}
        </SettingsPage>
    );
}

function DeleteMcpServerButton({
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
                variant="destructive"
            >
                Confirm
            </Button>
        );
    }

    return (
        <Button disabled={disabled} onClick={() => setConfirming(true)} variant="ghost">
            Delete
        </Button>
    );
}
