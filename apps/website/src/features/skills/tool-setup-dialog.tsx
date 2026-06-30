import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import {
    useToolConfig,
    useToolEnvSave,
    useToolPostSetupRun,
    useToolProviderSet,
} from '../../hooks/skills/use-tool-setup.ts';
import type { SkillListOutput, ToolConfigOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';

type ToolSummary = SkillListOutput['tools'][number];
type ToolProvider = ToolConfigOutput['providers'][number];

export function ToolSetupDialog({
    onOpenChange,
    tool,
}: {
    onOpenChange: (open: boolean) => void;
    tool: null | ToolSummary;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={tool !== null}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set up {tool?.name ?? 'tool'}</DialogTitle>
                    <DialogDescription>
                        Pick a provider and add its keys so the agent can use this tool.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel>{tool ? <ToolSetupBody toolId={tool.id} /> : null}</DialogPanel>
            </DialogContent>
        </Dialog>
    );
}

function ToolSetupBody({ toolId }: { toolId: string }) {
    const configQuery = useToolConfig({ toolId });
    const setProvider = useToolProviderSet();
    const [selectedProvider, setSelectedProvider] = React.useState<null | string>(null);

    if (configQuery.isPending) {
        return (
            <div className="grid min-h-32 place-items-center">
                <Spinner className="size-5" />
            </div>
        );
    }
    if (configQuery.error) {
        return <p className="text-error text-sm">{configQuery.error.message}</p>;
    }

    const config = configQuery.data;
    if (!config || config.providers.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">
                This tool has no configurable providers. It may need engine-level setup.
            </p>
        );
    }

    const activeName = selectedProvider ?? config.activeProvider ?? config.providers[0]?.name;
    const activeProvider = config.providers.find((provider) => provider.name === activeName);

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                {config.providers.map((provider) => (
                    <button
                        className={cn(
                            'flex items-center gap-2 rounded-xl border border-border/70 px-4 py-2.5 text-left transition-colors hover:border-border-strong',
                            provider.name === activeName && 'border-ring bg-accent/35'
                        )}
                        key={provider.name}
                        onClick={() => {
                            setSelectedProvider(provider.name);
                            if (!provider.isActive) {
                                setProvider.mutate({ provider: provider.name, toolId });
                            }
                        }}
                        type="button"
                    >
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
                            {provider.name}
                        </span>
                        {provider.badge ? (
                            <Badge size="sm" variant="subtle">
                                {provider.badge}
                            </Badge>
                        ) : null}
                        {provider.isActive ? (
                            <Badge size="sm" variant="success">
                                Active
                            </Badge>
                        ) : null}
                    </button>
                ))}
            </div>
            {setProvider.error ? (
                <p className="text-error text-sm">{setProvider.error.message}</p>
            ) : null}

            {activeProvider ? <ProviderSetup provider={activeProvider} toolId={toolId} /> : null}
        </div>
    );
}

function ProviderSetup({ provider, toolId }: { provider: ToolProvider; toolId: string }) {
    const saveEnv = useToolEnvSave();
    const runPostSetup = useToolPostSetupRun();
    const [values, setValues] = React.useState<Record<string, string>>({});
    const pendingEntries = Object.entries(values).filter(([, value]) => value.trim().length > 0);

    return (
        <div className="grid gap-3">
            {provider.envVars.map((envVar) => (
                <label className="grid gap-1" key={envVar.key}>
                    <span className="flex items-center gap-2 text-foreground text-sm">
                        {envVar.prompt}
                        {envVar.isSet ? (
                            <Badge size="sm" variant="success">
                                Set
                            </Badge>
                        ) : null}
                    </span>
                    <Input
                        autoComplete="off"
                        onChange={(event) =>
                            setValues((previous) => ({
                                ...previous,
                                [envVar.key]: event.target.value,
                            }))
                        }
                        placeholder={
                            envVar.isSet ? 'Leave blank to keep the saved key' : envVar.key
                        }
                        type="password"
                        value={values[envVar.key] ?? ''}
                    />
                </label>
            ))}

            {saveEnv.error ? <p className="text-error text-sm">{saveEnv.error.message}</p> : null}
            {runPostSetup.error ? (
                <p className="text-error text-sm">{runPostSetup.error.message}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
                {provider.postSetup ? (
                    <Button
                        disabled={runPostSetup.isPending}
                        onClick={() => {
                            if (provider.postSetup) {
                                runPostSetup.mutate({ key: provider.postSetup, toolId });
                            }
                        }}
                        variant="outline"
                    >
                        {runPostSetup.isPending ? <Spinner className="size-4" /> : null}
                        {runPostSetup.isPending ? 'Installing…' : 'Run install step'}
                    </Button>
                ) : null}
                {provider.envVars.length > 0 ? (
                    <Button
                        disabled={pendingEntries.length === 0 || saveEnv.isPending}
                        onClick={() => {
                            saveEnv.mutate(
                                { env: Object.fromEntries(pendingEntries), toolId },
                                { onSuccess: () => setValues({}) }
                            );
                        }}
                    >
                        {saveEnv.isPending ? <Spinner className="size-4" /> : null}
                        {saveEnv.isPending ? 'Saving…' : 'Save keys'}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
