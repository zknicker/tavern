import { BubbleChatQuestionIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { AskUserQuestions } from '../../../components/ui/ask-user-questions.tsx';
import { trpc } from '../../../lib/trpc.tsx';
import { hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import { getToolTarget, InlineToolLabel, ToolTimelineStep } from './tool-summary.tsx';
import type { ToolStepRendererProps } from './types.ts';

const skippedAnswer = 'The user cancelled. Use your best judgement to proceed.';

export function ClarificationToolStep({
    animateEnter,
    canRespondToClarification = false,
    chatId,
    isLast,
    row,
}: ToolStepRendererProps) {
    const fallbackQuestion = getToolTarget(row);
    const clarification = row.clarification;
    const question = clarification?.question ?? fallbackQuestion;
    const isPending = !(row.completedAt || hasErrorStatus(row.toolCall.status));
    const localResponse = useLocalClarificationResponse();
    const verb = getClarificationVerb({
        completedAt: row.completedAt,
        disposition: localResponse.disposition ?? clarification?.disposition ?? null,
        isPending,
    });

    return (
        <ToolTimelineStep
            animateEnter={animateEnter}
            chatId={chatId}
            icon={BubbleChatQuestionIcon}
            isLast={isLast}
            label={<InlineToolLabel row={row} target={question} verb={verb} />}
            row={row}
        >
            {clarification && isPending && canRespondToClarification && chatId && row.sessionKey ? (
                <ClarificationActions
                    chatId={chatId}
                    clarification={clarification}
                    localResponse={localResponse}
                    sessionKey={row.sessionKey}
                />
            ) : (
                <ClarificationState
                    answer={localResponse.answer ?? clarification?.answer ?? null}
                    disposition={localResponse.disposition ?? clarification?.disposition ?? null}
                />
            )}
        </ToolTimelineStep>
    );
}

function ClarificationActions({
    chatId,
    clarification,
    localResponse,
    sessionKey,
}: {
    chatId: string;
    clarification: NonNullable<ToolStepRendererProps['row']['clarification']>;
    localResponse: LocalClarificationResponseHandle;
    sessionKey: string;
}) {
    const respond = trpc.chat.clarification.respond.useMutation();
    const deadlineLabel = useDeadlineLabel(clarification.deadlineAt, !localResponse.disposition);
    const disabled = respond.isPending || Boolean(localResponse.disposition);
    const choices = clarification.choices.map((choice) => ({ id: choice, label: choice }));

    const send = (answer: string, disposition: LocalClarificationResponse['disposition']) => {
        const response = { answer, disposition };
        localResponse.set(response);
        respond.mutate(
            {
                answer,
                chatId,
                disposition,
                requestId: clarification.requestId,
                sessionKey,
            },
            {
                onError: () => localResponse.set(null),
            }
        );
    };

    if (localResponse.disposition && !respond.isError) {
        return (
            <ClarificationState
                answer={localResponse.answer}
                disposition={localResponse.disposition}
            />
        );
    }

    return (
        <div className="space-y-1.5 pt-1 pb-1.5">
            <AskUserQuestions
                disabled={disabled}
                onComplete={(answer) => send(answer.value, 'answered')}
                onSkip={() => send(skippedAnswer, 'skipped')}
                questions={[
                    {
                        allowOther: true,
                        id: clarification.requestId,
                        options: choices,
                        skippable: true,
                        title: clarification.question,
                    },
                ]}
            />
            <div className="flex flex-wrap items-center gap-2 text-meta text-muted-foreground">
                {deadlineLabel ? <span>{deadlineLabel}</span> : null}
                {respond.isError ? (
                    <span className="text-destructive">Could not send the response.</span>
                ) : null}
            </div>
        </div>
    );
}

function ClarificationState({
    answer,
    disposition,
}: {
    answer: string | null;
    disposition: LocalClarificationResponse['disposition'] | null;
}) {
    if (!(disposition || answer)) {
        return null;
    }

    const label =
        disposition === 'skipped'
            ? 'Skipped.'
            : disposition === 'timeout'
              ? 'Timed out.'
              : answer
                ? `Answered: ${answer}`
                : 'Answered.';

    return <p className="pt-1 pb-1.5 text-meta text-muted-foreground">{label}</p>;
}

function getClarificationVerb({
    completedAt,
    disposition,
    isPending,
}: {
    completedAt: string | null;
    disposition: LocalClarificationResponse['disposition'] | null;
    isPending: boolean;
}) {
    if (isPending) {
        return 'Needs answer';
    }

    if (disposition === 'skipped') {
        return 'Skipped';
    }

    if (disposition === 'timeout') {
        return 'Timed out';
    }

    return completedAt ? 'Answered' : 'Clarification';
}

function useDeadlineLabel(deadlineAt: string | null | undefined, enabled: boolean) {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!(deadlineAt && enabled)) {
            return;
        }

        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [deadlineAt, enabled]);

    if (!(deadlineAt && enabled)) {
        return null;
    }

    const remainingSeconds = Math.ceil(Math.max(0, Date.parse(deadlineAt) - now) / 1000);

    return remainingSeconds > 0 ? `Times out in ${remainingSeconds}s` : 'Timing out';
}

interface LocalClarificationResponse {
    answer: string;
    disposition: 'answered' | 'skipped' | 'timeout';
}

interface LocalClarificationResponseHandle {
    answer: string | null;
    disposition: LocalClarificationResponse['disposition'] | null;
    set: React.Dispatch<React.SetStateAction<LocalClarificationResponse | null>>;
}

function useLocalClarificationResponse() {
    const [response, setResponse] = React.useState<LocalClarificationResponse | null>(null);

    return {
        answer: response?.answer ?? null,
        disposition: response?.disposition ?? null,
        set: setResponse,
    } satisfies LocalClarificationResponseHandle;
}
