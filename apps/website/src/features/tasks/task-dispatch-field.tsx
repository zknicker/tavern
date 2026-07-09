import { BubbleChatIcon, SentIcon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { TaskActivityIndicator } from './task-activity-indicator.tsx';
import { TaskEditorSection } from './task-editor-sidebar.tsx';
import { TaskFieldRow } from './task-fields.tsx';
import { type TaskDispatchTrigger, taskDispatchTriggerLabels } from './task-presentation.ts';

interface TaskDispatchFieldProps {
    activeDispatchRunId: string | null;
    agents: AgentSelectOption[];
    disabledReason: string | null;
    dispatchAgentId: string | null;
    dispatchAttempts: number;
    dispatchTrigger: TaskDispatchTrigger | null;
    isDispatching: boolean;
    onDispatch: () => void;
    onDispatchAgentChange: (agentId: string) => void;
    onOpenWorkChat: () => void;
    workChatId: string | null;
}

export function TaskDispatchField({
    activeDispatchRunId,
    agents,
    disabledReason,
    dispatchAgentId,
    dispatchAttempts,
    dispatchTrigger,
    isDispatching,
    onDispatch,
    onDispatchAgentChange,
    onOpenWorkChat,
    workChatId,
}: TaskDispatchFieldProps) {
    const dispatchAgent = agents.find((agent) => agent.id === dispatchAgentId);
    const isWorking = activeDispatchRunId !== null;
    const triggerLabel = dispatchTrigger ? taskDispatchTriggerLabels[dispatchTrigger] : null;

    return (
        <TaskEditorSection title="Dispatch">
            <div className="grid gap-2">
                {isWorking ? (
                    <button
                        className="flex items-center gap-2 rounded-lg bg-info-bg/60 px-2.5 py-2 text-left text-info-foreground outline-none transition-colors hover:bg-info-bg focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-64"
                        disabled={!workChatId}
                        onClick={onOpenWorkChat}
                        type="button"
                    >
                        <TaskActivityIndicator label="Working now" />
                        <span className="text-sm">Working now</span>
                        {workChatId ? (
                            <span className="ml-auto flex items-center gap-1 text-info-foreground/80 text-xs">
                                <Icon
                                    aria-hidden="true"
                                    className="size-3.5"
                                    icon={BubbleChatIcon}
                                />
                                Open work chat
                            </span>
                        ) : null}
                    </button>
                ) : null}
                <TaskFieldRow label="Agent">
                    <Select
                        disabled={isDispatching || agents.length === 0}
                        onValueChange={(next) => {
                            if (next) {
                                onDispatchAgentChange(next);
                            }
                        }}
                        value={dispatchAgentId ?? ''}
                    >
                        <SelectTrigger className="max-w-[12rem]" size="sm">
                            <SelectValue placeholder="Choose agent">
                                {dispatchAgent ? (
                                    <AgentOptionLabel agent={dispatchAgent} />
                                ) : (
                                    'Choose agent'
                                )}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                    <AgentOptionLabel agent={agent} />
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TaskFieldRow>
                <div className="flex items-center justify-between gap-2">
                    {workChatId && !isWorking ? (
                        <Button
                            className="shrink-0 text-muted-foreground"
                            onClick={onOpenWorkChat}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" className="size-4" icon={BubbleChatIcon} />
                            Open work chat
                        </Button>
                    ) : (
                        <span />
                    )}
                    <Button
                        className="shrink-0"
                        disabled={disabledReason !== null || dispatchAgentId === null || isWorking}
                        loading={isDispatching}
                        onClick={onDispatch}
                        size="sm"
                        title={disabledReason ?? undefined}
                        type="button"
                        variant="secondary"
                    >
                        <Icon aria-hidden="true" className="size-4" icon={SentIcon} />
                        Dispatch
                    </Button>
                </div>
                {triggerLabel ? (
                    <p className="text-muted-foreground text-xs">
                        {triggerLabel}
                        {dispatchAttempts > 1 ? ` · ${dispatchAttempts} attempts` : ''}
                    </p>
                ) : null}
            </div>
        </TaskEditorSection>
    );
}
