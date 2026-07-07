import { SentIcon } from '@hugeicons/core-free-icons';
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

interface TaskDispatchFieldProps {
    agents: AgentSelectOption[];
    disabledReason: string | null;
    dispatchAgentId: string | null;
    isDispatching: boolean;
    onDispatch: () => void;
    onDispatchAgentChange: (agentId: string) => void;
}

export function TaskDispatchField({
    agents,
    disabledReason,
    dispatchAgentId,
    isDispatching,
    onDispatch,
    onDispatchAgentChange,
}: TaskDispatchFieldProps) {
    const dispatchAgent = agents.find((agent) => agent.id === dispatchAgentId);

    return (
        <TaskEditorSection title="Dispatch">
            <div className="grid gap-2">
                <Select
                    disabled={isDispatching || agents.length === 0}
                    onValueChange={(next) => {
                        if (next) {
                            onDispatchAgentChange(next);
                        }
                    }}
                    value={dispatchAgentId ?? ''}
                >
                    <SelectTrigger className="w-full">
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
                <Button
                    disabled={disabledReason !== null || dispatchAgentId === null}
                    loading={isDispatching}
                    onClick={onDispatch}
                    title={disabledReason ?? undefined}
                    type="button"
                    variant="secondary"
                >
                    <Icon aria-hidden="true" className="size-4" icon={SentIcon} />
                    Dispatch to agent
                </Button>
                <p className="text-muted-foreground text-xs">
                    Sends this task into the agent's direct chat so the work happens in the room.
                </p>
            </div>
        </TaskEditorSection>
    );
}
