import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import {
    useMcpServerAdd,
    useMcpServerEnabledSet,
    useMcpServerRemove,
    useMcpServers,
    useMcpServerTest,
} from '../../hooks/skills/use-mcp-servers.ts';
import type { McpServerListOutput } from '../../lib/trpc.tsx';

type McpServer = McpServerListOutput['servers'][number];

export function McpServersPanel({ open }: { open: boolean }) {
    const serversQuery = useMcpServers({ enabled: open });
    const servers = serversQuery.data?.servers ?? [];

    return (
        <div className="grid gap-5">
            <AddMcpServerForm />

            <section className="grid gap-2">
                <h3 className="font-medium text-foreground text-sm">Your MCP servers</h3>
                {serversQuery.isPending ? (
                    <div className="grid min-h-16 place-items-center">
                        <Spinner className="size-4" />
                    </div>
                ) : servers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No custom MCP servers yet. Add one above or install from the catalog.
                    </p>
                ) : (
                    servers.map((server) => <McpServerRow key={server.name} server={server} />)
                )}
                {serversQuery.error ? (
                    <p className="text-error text-sm">{serversQuery.error.message}</p>
                ) : null}
            </section>
        </div>
    );
}

function AddMcpServerForm() {
    const addServer = useMcpServerAdd();
    const [name, setName] = React.useState('');
    const [target, setTarget] = React.useState('');
    const trimmedTarget = target.trim();
    const isUrl = /^https?:\/\//u.test(trimmedTarget);
    const canAdd = name.trim().length > 0 && trimmedTarget.length > 0;

    return (
        <form
            className="grid gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                if (!canAdd) {
                    return;
                }
                const [command, ...args] = trimmedTarget.split(/\s+/u);
                addServer.mutate(
                    {
                        name: name.trim(),
                        ...(isUrl
                            ? { url: trimmedTarget }
                            : { args, command: command ?? trimmedTarget }),
                    },
                    {
                        onSuccess: () => {
                            setName('');
                            setTarget('');
                        },
                    }
                );
            }}
        >
            <h3 className="font-medium text-foreground text-sm">Add a custom MCP server</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    aria-label="Server name"
                    className="sm:max-w-44"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Name"
                    value={name}
                />
                <Input
                    aria-label="Server URL or command"
                    className="flex-1"
                    onChange={(event) => setTarget(event.target.value)}
                    placeholder="https://… or command to run"
                    value={target}
                />
                <Button disabled={!canAdd || addServer.isPending} type="submit" variant="outline">
                    {addServer.isPending ? 'Adding…' : 'Add server'}
                </Button>
            </div>
            {addServer.error ? (
                <p className="text-error text-sm">{addServer.error.message}</p>
            ) : null}
        </form>
    );
}

function McpServerRow({ server }: { server: McpServer }) {
    const removeServer = useMcpServerRemove();
    const setEnabled = useMcpServerEnabledSet();
    const testServer = useMcpServerTest();
    const testResult = testServer.data;

    return (
        <div className="grid gap-2 rounded-xl border border-border/70 px-4 py-2.5">
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground text-sm">
                            {server.name}
                        </p>
                        <Badge size="sm" variant="subtle">
                            {server.transport}
                        </Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-muted-foreground text-xs">
                        {server.url ?? [server.command, ...server.args].filter(Boolean).join(' ')}
                    </p>
                </div>
                <Button
                    disabled={testServer.isPending}
                    onClick={() => testServer.mutate({ name: server.name })}
                    size="sm"
                    variant="ghost"
                >
                    {testServer.isPending ? 'Testing…' : 'Test'}
                </Button>
                <Button
                    disabled={removeServer.isPending}
                    onClick={() => removeServer.mutate({ name: server.name })}
                    size="sm"
                    variant="ghost"
                >
                    Remove
                </Button>
                <Switch
                    aria-label={`${server.enabled ? 'Disable' : 'Enable'} ${server.name}`}
                    checked={server.enabled}
                    disabled={setEnabled.isPending}
                    onCheckedChange={(checked) =>
                        setEnabled.mutate({ enabled: checked, name: server.name })
                    }
                />
            </div>

            {testResult ? (
                <p
                    className={
                        testResult.ok ? 'text-muted-foreground text-xs' : 'text-error text-xs'
                    }
                >
                    {testResult.ok
                        ? `Connected. ${testResult.tools.length} tools available.`
                        : (testResult.error ?? 'Connection failed.')}
                </p>
            ) : null}
            {testServer.error ? (
                <p className="text-error text-xs">{testServer.error.message}</p>
            ) : null}
            {removeServer.error ? (
                <p className="text-error text-xs">{removeServer.error.message}</p>
            ) : null}
        </div>
    );
}
