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
import { TaskEditorSection } from './task-editor-sidebar.tsx';
import { TaskFieldRow } from './task-fields.tsx';

interface TaskDispatchFieldProps {
    agents: AgentSelectOption[];
    disabledReason: string | null;
    dispatchAgentId: string | null;
    isDispatching: boolean;
    onDispatch: () => void;
    onDispatchAgentChange: (agentId: string) => void;
    onOpenWorkChat: () => void;
    workChatId: string | null;
}

export function TaskDispatchField({
    agents,
    disabledReason,
    dispatchAgentId,
    isDispatching,
    onDispatch,
    onDispatchAgentChange,
    onOpenWorkChat,
    workChatId,
}: TaskDispatchFieldProps) {
    const dispatchAgent = agents.find((agent) => agent.id === dispatchAgentId);

    return (
        <TaskEditorSection title="Dispatch">
            <div className="grid gap-2">
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
                    {workChatId ? (
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
                        disabled={disabledReason !== null || dispatchAgentId === null}
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
            </div>
        </TaskEditorSection>
    );
}
