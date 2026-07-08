import * as React from 'react';
import { Input } from '../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { TaskEditorSection } from './task-editor-sidebar.tsx';
import { TaskFieldRow } from './task-fields.tsx';
import { type TaskBlockedReasonKind, taskBlockedReasonLabels } from './task-presentation.ts';

interface TaskBlockedReasonProps {
    disabled?: boolean;
    onChange: (blockedReason: TaskRecord['blockedReason']) => void;
    value: TaskRecord['blockedReason'];
}

// Shown when a task is blocked. Agents always set a reason; when a human blocks
// from the UI the reason is optional, so an empty message clears it to null.
export function TaskBlockedReason({ disabled = false, onChange, value }: TaskBlockedReasonProps) {
    const kind: TaskBlockedReasonKind = value?.kind ?? 'needs_input';
    const [message, setMessage] = React.useState(value?.message ?? '');

    // Adopt external edits (agent tools, other windows).
    React.useEffect(() => {
        setMessage(value?.message ?? '');
    }, [value?.message]);

    const commit = React.useCallback(
        (nextKind: TaskBlockedReasonKind, nextMessage: string) => {
            const trimmed = nextMessage.trim();
            onChange(trimmed ? { kind: nextKind, message: trimmed } : null);
        },
        [onChange]
    );

    return (
        <TaskEditorSection title="Blocked reason">
            <div className="grid gap-2">
                <TaskFieldRow label="Kind">
                    <Select
                        disabled={disabled}
                        onValueChange={(next) => {
                            if (next) {
                                commit(next as TaskBlockedReasonKind, message);
                            }
                        }}
                        value={kind}
                    >
                        <SelectTrigger className="max-w-[12rem]" size="sm">
                            <SelectValue>{taskBlockedReasonLabels[kind]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="needs_input">
                                {taskBlockedReasonLabels.needs_input}
                            </SelectItem>
                            <SelectItem value="error">{taskBlockedReasonLabels.error}</SelectItem>
                        </SelectContent>
                    </Select>
                </TaskFieldRow>
                <TaskFieldRow label="Message">
                    <Input
                        className="max-w-[12rem]"
                        disabled={disabled}
                        onBlur={() => commit(kind, message)}
                        onChange={(event) => setMessage(event.currentTarget.value)}
                        placeholder="Optional"
                        size="sm"
                        value={message}
                    />
                </TaskFieldRow>
            </div>
        </TaskEditorSection>
    );
}
