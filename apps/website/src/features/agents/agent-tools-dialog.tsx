import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    type AgentToolPolicyView,
    coreToolOptions,
    normalizeToolList,
} from './agent-tool-policy.ts';
import { useAgentToolsSave } from './use-agent-tools-save.ts';

export function AgentToolsDialog({
    agent,
    onOpenChange,
    open,
    toolPolicy,
}: {
    agent: AgentListOutput['agents'][number];
    onOpenChange: (open: boolean) => void;
    open: boolean;
    toolPolicy: AgentToolPolicyView;
}) {
    const saveTools = useAgentToolsSave();
    const [customTool, setCustomTool] = React.useState('');
    const [selectedTools, setSelectedTools] = React.useState<string[]>(toolPolicy.tools);
    const selectedSet = React.useMemo(() => new Set(selectedTools), [selectedTools]);
    const customToolValue = customTool.trim().toLowerCase();
    const canAddCustomTool = customToolValue.length > 0 && /^[^\s,]+$/u.test(customToolValue);
    const coreToolIds = React.useMemo<Set<string>>(
        () => new Set(coreToolOptions.map((tool) => tool.id)),
        []
    );
    const customTools = selectedTools.filter((tool) => !coreToolIds.has(tool));

    React.useEffect(() => {
        if (open) {
            setSelectedTools(toolPolicy.tools.filter((tool) => tool !== '*'));
            setCustomTool('');
        }
    }, [open, toolPolicy.tools]);

    function setToolSelected(tool: string, selected: boolean) {
        setSelectedTools((current) =>
            selected
                ? normalizeToolList([...current, tool])
                : current.filter((entry) => entry !== tool)
        );
    }

    function addCustomTool() {
        if (!canAddCustomTool) {
            return;
        }

        setSelectedTools((current) => normalizeToolList([...current, customToolValue]));
        setCustomTool('');
    }

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Agent tools</DialogTitle>
                    <DialogDescription>
                        Tools selected here are written to {agent.name}&apos;s Hermes agent config.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="grid gap-4">
                    {toolPolicy.inheritedProfile ? (
                        <p className="rounded-lg border border-border bg-muted/25 px-3 py-2 text-muted-foreground text-sm">
                            Editing converts the Hermes {toolPolicy.inheritedProfile} profile to an
                            explicit per-agent allowlist.
                        </p>
                    ) : null}
                    <div className="grid gap-2">
                        <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
                            Common tools
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {coreToolOptions.map((tool) => {
                                const selected = selectedSet.has(tool.id);
                                return (
                                    <ToolToggleCard
                                        checked={selected}
                                        group={tool.group}
                                        key={tool.id}
                                        label={tool.label}
                                        onCheckedChange={(checked) =>
                                            setToolSelected(tool.id, checked)
                                        }
                                    />
                                );
                            })}
                        </div>
                    </div>
                    {customTools.length > 0 ? (
                        <div className="grid gap-2">
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
                                Custom tools
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                {customTools.map((tool) => (
                                    <ToolToggleCard
                                        checked
                                        group="Custom"
                                        key={tool}
                                        label={tool}
                                        onCheckedChange={(checked) =>
                                            setToolSelected(tool, checked)
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    ) : null}
                    <div className="flex gap-2">
                        <Input
                            onChange={(event) => setCustomTool(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addCustomTool();
                                }
                            }}
                            placeholder="custom_tool"
                            value={customTool}
                        />
                        <Button
                            disabled={!canAddCustomTool}
                            onClick={addCustomTool}
                            type="button"
                            variant="outline"
                        >
                            Add
                        </Button>
                    </div>
                    {saveTools.error ? (
                        <p className="rounded-md border border-error/20 bg-error/5 px-3 py-2 text-error text-sm">
                            {saveTools.error.message}
                        </p>
                    ) : null}
                </DialogPanel>
                <DialogFooter>
                    <Button
                        disabled={saveTools.isPending}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled={saveTools.isPending}
                        onClick={() => {
                            saveTools.mutate(
                                {
                                    agentId: agent.id,
                                    tools: selectedTools,
                                },
                                {
                                    onSuccess: () => onOpenChange(false),
                                }
                            );
                        }}
                        type="button"
                    >
                        Save tools
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ToolToggleCard({
    checked,
    group,
    label,
    onCheckedChange,
}: {
    checked: boolean;
    group: string;
    label: string;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <Switch
            aria-label={`${checked ? 'Remove' : 'Add'} ${label}`}
            checked={checked}
            className={cn(
                'group grid min-h-16 w-full cursor-pointer select-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2 text-left outline-none ring-ring/24 transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out focus-visible:ring-[3px] active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none',
                checked
                    ? 'border-transparent bg-muted text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:bg-accent/35 hover:text-foreground'
            )}
            onCheckedChange={onCheckedChange}
            unstyled
        >
            <span className="min-w-0">
                <span className="block truncate font-medium text-sm">{label}</span>
                <span className="block truncate text-muted-foreground text-xs">{group}</span>
            </span>
            <span className="pointer-events-none inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input p-0.5 transition-colors group-data-[checked]:bg-brand">
                <span className="block size-4 translate-x-0 transform-gpu rounded-full bg-card transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-95 group-data-[checked]:translate-x-4 motion-reduce:transition-none dark:bg-foreground" />
            </span>
        </Switch>
    );
}
