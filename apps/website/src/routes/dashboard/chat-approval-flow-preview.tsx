import * as React from 'react';
import { AskUserQuestions } from '../../components/ui/ask-user-questions.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import {
    ChatApprovalFlow,
    ChatApprovalFlowComposer,
} from '../../features/chats/chat-approval-prompt.tsx';
import { cn } from '../../lib/utils.ts';

type ApprovalPreviewMode = 'approval' | 'regular';

const approvalPreviewChoices = [
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
];

export function ApprovalFlowMotionPreview() {
    const [mode, setMode] = React.useState<ApprovalPreviewMode>('regular');
    const approvalActive = mode === 'approval';

    return (
        <section className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex flex-wrap items-center justify-between gap-3 border-border border-b px-4 py-3">
                <h2 className="font-medium text-foreground text-sm">Approval footer motion</h2>
                <div className="flex rounded-lg bg-muted/40 p-1">
                    {(['regular', 'approval'] as const).map((option) => (
                        <Button
                            aria-pressed={mode === option}
                            className={cn(
                                'h-7 border-transparent px-2.5 capitalize shadow-none',
                                mode === option
                                    ? 'bg-background text-foreground shadow-xs hover:bg-background'
                                    : 'text-muted-foreground'
                            )}
                            key={option}
                            onClick={() => setMode(option)}
                            size="xs"
                            type="button"
                            variant={mode === option ? 'secondary' : 'ghost'}
                        >
                            {option}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="flex min-h-[38rem] flex-col justify-end bg-surface-1/40 px-6 pt-10 pb-6">
                <div className="mx-auto mb-6 w-full max-w-[44rem] space-y-5 px-6 text-sm">
                    <div className="ml-auto w-fit max-w-[28rem] rounded-full bg-muted/55 px-4 py-2 text-foreground">
                        try again pls
                    </div>
                    <div className="space-y-2 text-foreground/86">
                        <p>Retrying the delete now with your confirmation.</p>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-base leading-none">⌘</span>
                            <span className="thinking-indicator-text">
                                Using delete in root path
                            </span>
                        </div>
                    </div>
                </div>
                <div className="mx-auto w-full max-w-[44rem]">
                    <ChatApprovalFlow active={approvalActive}>
                        {approvalActive ? <ApprovalPreviewCard /> : null}
                        <ChatApprovalFlowComposer>
                            <StaticComposerPreview approvalActive={approvalActive} />
                        </ChatApprovalFlowComposer>
                    </ChatApprovalFlow>
                </div>
            </div>
        </section>
    );
}

function ApprovalPreviewCard() {
    return (
        <div className="chat-approval-flow-card px-6 pb-2">
            <AskUserQuestions
                className="mx-auto shadow-sm"
                onComplete={noop}
                questions={[
                    {
                        description: (
                            <div className="space-y-1.5">
                                <code className="block max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface-1 px-2 py-1.5 font-mono text-[12px] text-foreground/80 leading-relaxed">
                                    rm -rf /tmp/tavern-approval-preview-nonexistent
                                </code>
                                <p className="px-1 text-muted-foreground text-xs leading-snug">
                                    Reason: delete in root path
                                </p>
                            </div>
                        ),
                        id: 'approval-preview',
                        options: approvalPreviewChoices,
                        skippable: false,
                        title: 'Do you want to approve this command?',
                    },
                ]}
                showProgress={false}
            />
        </div>
    );
}

function StaticComposerPreview({ approvalActive }: { approvalActive: boolean }) {
    return (
        <PromptInput
            className="w-full px-6 pt-1 pb-4"
            onSubmit={(event) => event.preventDefault()}
            surfaceClassName={cn(approvalActive && 'cursor-not-allowed opacity-60')}
        >
            <PromptInputBody>
                <Textarea
                    aria-disabled={approvalActive}
                    aria-label="Approval flow composer preview"
                    placeholder="Let's go on an adventure..."
                    readOnly
                    textareaClassName="min-h-0 resize-none bg-transparent px-3 pt-1.5 pb-0 text-sm leading-6 placeholder:text-muted-foreground/60"
                    unstyled
                />
            </PromptInputBody>
            <PromptInputFooter>
                <PromptInputTools>
                    <span
                        className={cn(
                            'px-2 text-muted-foreground text-sm',
                            approvalActive && 'opacity-60'
                        )}
                    >
                        +
                    </span>
                </PromptInputTools>
                <PromptInputActions>
                    <span
                        className={cn(
                            'px-2 text-muted-foreground text-sm',
                            approvalActive && 'opacity-60'
                        )}
                    >
                        Sonnet 5
                    </span>
                    <PromptInputSubmit
                        canSubmit={!approvalActive}
                        label="Send message"
                        tooltip={
                            approvalActive
                                ? 'Respond to the pending approval before sending another message.'
                                : undefined
                        }
                    />
                </PromptInputActions>
            </PromptInputFooter>
        </PromptInput>
    );
}

function noop() {}
