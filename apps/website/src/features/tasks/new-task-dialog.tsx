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
import { Field, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import { useChatSend } from '../../hooks/chats/use-chat-send.ts';
import { useTaskConvert } from '../../hooks/tasks/use-task-mutations.ts';
import type { AgentSelectOption } from '../agents/agent-option-label.tsx';
import { AgentOptionLabel } from '../agents/agent-option-label.tsx';

export interface TaskComposeChat {
    id: string;
    label: string;
}

export function NewTaskDialog({
    agents,
    chats,
    defaultChatId,
    onOpenChange,
    open,
}: {
    agents: AgentSelectOption[];
    chats: TaskComposeChat[];
    defaultChatId?: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const send = useChatSend();
    const convert = useTaskConvert();
    const [body, setBody] = React.useState('');
    const [chatId, setChatId] = React.useState(defaultChatId ?? '');
    const [assigneeId, setAssigneeId] = React.useState('unassigned');

    React.useEffect(() => {
        if (open) {
            setBody('');
            setChatId(defaultChatId ?? chats[0]?.id ?? '');
            setAssigneeId('unassigned');
        }
    }, [chats, defaultChatId, open]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        const content = body.trim();
        if (!(content && chatId)) {
            return;
        }
        const messageId = `msg_${crypto.randomUUID()}`;
        // Send the message first, then promote it as a task. An assignee turns
        // the promotion into a reservation whose assignment receipt @mentions
        // (and pierces to) the assignee — so route through convert rather than
        // the composer's auto-promote.
        await send.mutateAsync({ chatId, clientMessageId: messageId, content });
        await convert.mutateAsync({
            messageId,
            origin: 'composed',
            ...(assigneeId === 'unassigned' ? {} : { assigneeId }),
        });
        onOpenChange(false);
    }

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent showCloseButton={false}>
                <Form className="contents" onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>New task</DialogTitle>
                        <DialogDescription>
                            Create a task from a new chat message.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogPanel className="grid gap-4">
                        {defaultChatId ? null : (
                            <Field>
                                <FieldLabel>Chat</FieldLabel>
                                <Select
                                    onValueChange={(value) => value && setChatId(value)}
                                    value={chatId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a chat" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {chats.map((chat) => (
                                            <SelectItem key={chat.id} value={chat.id}>
                                                {chat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                        <Field>
                            <FieldLabel>Task</FieldLabel>
                            <Textarea
                                autoFocus
                                onChange={(event) => setBody(event.target.value)}
                                placeholder="What needs to be done?"
                                rows={4}
                                value={body}
                            />
                        </Field>
                        <Field>
                            <FieldLabel>
                                Assignee{' '}
                                <span className="font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </FieldLabel>
                            <Select
                                onValueChange={(value) => value && setAssigneeId(value)}
                                value={assigneeId}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            <AgentOptionLabel agent={agent} />
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        {send.error || convert.error ? (
                            <p className="text-destructive text-sm">
                                {send.error?.message ?? convert.error?.message}
                            </p>
                        ) : null}
                    </DialogPanel>
                    <DialogFooter variant="bare">
                        <Button
                            onClick={() => onOpenChange(false)}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={!(body.trim() && chatId)}
                            loading={send.isPending || convert.isPending}
                            size="sm"
                            type="submit"
                        >
                            Create task
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
