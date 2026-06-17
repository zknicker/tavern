import * as React from 'react';
import {
    type AskUserQuestionAnswer,
    AskUserQuestions,
} from '../../components/ui/ask-user-questions.tsx';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { hasErrorStatus } from '../sessions/tools/tool-ui.ts';

type ChatLogRow = NonNullable<ChatLogOutput>['rows'][number];
type ToolRow = Extract<ChatLogRow, { kind: 'tool' }>;
type ChatApprovalChoice = 'always' | 'deny' | 'once' | 'session';

export interface PendingChatApprovalPrompt {
    command: string;
    description: string | null;
    id: string;
    sessionKey: string;
}

const approvalChoices = [
    {
        description: 'Run this request one time',
        id: 'once',
        label: 'Allow once',
    },
    {
        description: 'Allow matching requests for this session',
        id: 'session',
        label: 'Allow session',
    },
    {
        description: 'Remember this approval for future matching requests',
        id: 'always',
        label: 'Always allow',
    },
    {
        description: 'Block this request',
        id: 'deny',
        label: 'Deny',
    },
] satisfies { description: string; id: ChatApprovalChoice; label: string }[];

export function ChatApprovalFlow({
    active,
    children,
    className,
}: {
    active: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('chat-approval-flow', active && 'chat-approval-flow-active', className)}>
            {children}
        </div>
    );
}

export function ChatApprovalFlowComposer({ children }: { children: React.ReactNode }) {
    return <div className="chat-approval-flow-composer">{children}</div>;
}

export function ChatApprovalPrompt({
    chatId,
    className,
    hasError = false,
    onAnswerError,
    onAnswered,
    prompt,
}: {
    chatId: string;
    className?: string;
    hasError?: boolean;
    onAnswerError?: (promptId: string) => void;
    onAnswered?: (promptId: string) => void;
    prompt: PendingChatApprovalPrompt | null;
}) {
    if (!prompt) {
        return null;
    }

    return (
        <ChatApprovalPromptContent
            chatId={chatId}
            className={className}
            hasError={hasError}
            key={prompt.id}
            onAnswerError={onAnswerError}
            onAnswered={onAnswered}
            prompt={prompt}
        />
    );
}

function ChatApprovalPromptContent({
    chatId,
    className,
    hasError,
    onAnswerError,
    onAnswered,
    prompt,
}: {
    chatId: string;
    className?: string;
    hasError: boolean;
    onAnswerError?: (promptId: string) => void;
    onAnswered?: (promptId: string) => void;
    prompt: PendingChatApprovalPrompt;
}) {
    const respond = trpc.chat.approval.respond.useMutation();

    const disabled = respond.isPending;
    const send = (answer: AskUserQuestionAnswer) => {
        const nextChoice = toApprovalChoice(answer.optionId);

        if (!nextChoice) {
            return;
        }

        onAnswered?.(prompt.id);
        respond.mutate(
            { chatId, choice: nextChoice, sessionKey: prompt.sessionKey },
            { onError: () => onAnswerError?.(prompt.id) }
        );
    };

    return (
        <div className={cn('chat-approval-flow-card px-6 pb-2', className)}>
            <AskUserQuestions
                className="mx-auto shadow-sm"
                disabled={disabled}
                onComplete={send}
                questions={[
                    {
                        description: (
                            <ApprovalCommandPreview
                                command={prompt.command}
                                description={prompt.description}
                            />
                        ),
                        id: prompt.id,
                        options: approvalChoices,
                        skippable: false,
                        title: 'Do you want to approve this command?',
                    },
                ]}
                showProgress={false}
            />
            {hasError || respond.isError ? (
                <p className="mx-auto mt-1 max-w-[520px] px-1 text-destructive text-meta">
                    Could not send the response.
                </p>
            ) : null}
        </div>
    );
}

export function getPendingChatApprovalPrompt(
    rows: NonNullable<ChatLogOutput>['rows']
): PendingChatApprovalPrompt | null {
    for (const row of rows) {
        if (!isPendingApprovalRow(row)) {
            continue;
        }

        return {
            command: row.approval?.command ?? approvalCommandLabel(row),
            description: row.approval?.description ?? null,
            id: row.id,
            sessionKey: row.sessionKey,
        };
    }

    return null;
}

export function getVisibleChatApprovalPrompt({
    answeredApprovalIds,
    rows,
}: {
    answeredApprovalIds: ReadonlySet<string>;
    rows: NonNullable<ChatLogOutput>['rows'];
}) {
    const prompt = getPendingChatApprovalPrompt(rows);

    if (!prompt || answeredApprovalIds.has(prompt.id)) {
        return null;
    }

    return prompt;
}

export function useChatApprovalPromptState(rows: NonNullable<ChatLogOutput>['rows']) {
    const [answeredApprovalIds, setAnsweredApprovalIds] = React.useState<ReadonlySet<string>>(
        () => new Set()
    );
    const [failedApprovalId, setFailedApprovalId] = React.useState<string | null>(null);
    const prompt = getVisibleChatApprovalPrompt({ answeredApprovalIds, rows });

    React.useEffect(() => {
        setAnsweredApprovalIds((current) => {
            if (current.size === 0) {
                return current;
            }

            const pendingIds = new Set(rows.filter(isPendingApprovalRow).map((row) => row.id));
            const next = new Set([...current].filter((id) => pendingIds.has(id)));

            return next.size === current.size ? current : next;
        });
    }, [rows]);

    React.useEffect(() => {
        if (!failedApprovalId || rows.some((row) => row.id === failedApprovalId)) {
            return;
        }

        setFailedApprovalId(null);
    }, [failedApprovalId, rows]);

    const markAnswered = React.useCallback((promptId: string) => {
        setFailedApprovalId((current) => (current === promptId ? null : current));
        setAnsweredApprovalIds((current) => {
            if (current.has(promptId)) {
                return current;
            }

            return new Set(current).add(promptId);
        });
    }, []);

    const markAnswerError = React.useCallback((promptId: string) => {
        setFailedApprovalId(promptId);
        setAnsweredApprovalIds((current) => {
            if (!current.has(promptId)) {
                return current;
            }

            const next = new Set(current);
            next.delete(promptId);
            return next;
        });
    }, []);

    return {
        hasError: prompt ? failedApprovalId === prompt.id : false,
        isActive: prompt !== null,
        markAnswerError,
        markAnswered,
        prompt,
    };
}

function ApprovalCommandPreview({
    command,
    description,
}: {
    command: string;
    description: string | null;
}) {
    return (
        <div className="space-y-1.5">
            <code className="block max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface-1 px-2 py-1.5 font-mono text-[12px] text-foreground/80 leading-relaxed">
                {command}
            </code>
            {description ? (
                <p className="px-1 text-muted-foreground text-xs leading-snug">
                    Reason: {description}
                </p>
            ) : null}
        </div>
    );
}

function isPendingApprovalRow(row: ChatLogRow): row is ToolRow & { sessionKey: string } {
    return (
        row.kind === 'tool' &&
        row.toolCall.name.trim().toLowerCase() === 'approval' &&
        !row.completedAt &&
        !hasErrorStatus(row.toolCall.status) &&
        typeof row.sessionKey === 'string' &&
        row.sessionKey.length > 0
    );
}

function approvalCommandLabel(row: ToolRow) {
    return row.toolCall.summaryParts.join(' ') || row.toolCall.label || row.toolCall.name;
}

function toApprovalChoice(value: string | null): ChatApprovalChoice | null {
    return approvalChoices.some((choice) => choice.id === value)
        ? (value as ChatApprovalChoice)
        : null;
}
