'use client';

import { ArrowRight02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useProximityHover } from '../../hooks/use-proximity-hover.ts';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';

export interface AskUserQuestionOption {
    description?: string | null;
    id: string;
    label: string;
}

export interface AskUserQuestion {
    allowOther?: boolean;
    description?: React.ReactNode;
    id: string;
    options: AskUserQuestionOption[];
    skippable?: boolean;
    title: string;
}

export interface AskUserQuestionAnswer {
    optionId: string | null;
    otherText: string;
    questionId: string;
    skipped: boolean;
    value: string;
}

export function AskUserQuestions({
    className,
    currentIndex = 0,
    disabled = false,
    onComplete,
    onSkip,
    questions,
    showProgress = true,
    skipLabel = 'Skip',
}: {
    className?: string;
    currentIndex?: number;
    disabled?: boolean;
    onComplete: (answer: AskUserQuestionAnswer) => void;
    onSkip?: (question: AskUserQuestion) => void;
    questions: AskUserQuestion[];
    showProgress?: boolean;
    skipLabel?: string;
}) {
    const question = questions[currentIndex];
    const titleId = React.useId();
    const descriptionId = React.useId();
    const rowsContainerRef = React.useRef<HTMLFieldSetElement>(null);
    const {
        activeIndex,
        handlers,
        itemRects,
        measureItems,
        registerItem,
        sessionRef,
        setActiveIndex,
    } = useProximityHover(rowsContainerRef);
    const [state, setState] = React.useState<QuestionAnswerState>({
        otherText: '',
        questionId: null,
        selectedId: null,
    });
    const questionLayoutKey = [
        currentIndex,
        question?.id ?? '',
        question?.options.length ?? 0,
        question?.allowOther === true ? 'other' : 'no-other',
        state.questionId ?? '',
        state.otherText.length,
    ].join(':');
    const questionRowsKey = [
        currentIndex,
        question?.id ?? '',
        question?.options.length ?? 0,
        question?.allowOther === true ? 'other' : 'no-other',
    ].join(':');

    React.useEffect(() => {
        if (questionLayoutKey.length > 0) {
            measureItems();
        }
    }, [measureItems, questionLayoutKey]);

    React.useEffect(() => {
        const container = rowsContainerRef.current;

        if (!container || questionRowsKey.length === 0) {
            return;
        }

        container.addEventListener('mouseenter', handlers.onMouseEnter);
        container.addEventListener('mousemove', handlers.onMouseMove);
        container.addEventListener('mouseleave', handlers.onMouseLeave);

        return () => {
            container.removeEventListener('mouseenter', handlers.onMouseEnter);
            container.removeEventListener('mousemove', handlers.onMouseMove);
            container.removeEventListener('mouseleave', handlers.onMouseLeave);
        };
    }, [handlers.onMouseEnter, handlers.onMouseLeave, handlers.onMouseMove, questionRowsKey]);

    React.useEffect(() => {
        if (questionRowsKey.length > 0) {
            setActiveIndex(null);
        }
    }, [questionRowsKey, setActiveIndex]);

    if (!question) {
        return null;
    }

    const selectedId = state.questionId === question.id ? state.selectedId : null;
    const otherText = state.questionId === question.id ? state.otherText : '';
    const otherId = `${question.id}:other`;
    const showOther = question.allowOther === true;
    const activeRect = activeIndex === null ? null : itemRects[activeIndex];
    const selectedOption = question.options.find((option) => option.id === selectedId);
    const selectedValue = selectedId === otherId ? otherText.trim() : selectedOption?.label.trim();
    const setSelection = (nextSelectedId: string, nextOtherText = otherText) => {
        setState({
            otherText: nextOtherText,
            questionId: question.id,
            selectedId: nextSelectedId,
        });
    };
    const complete = (value = selectedValue, optionId = selectedId) => {
        if (!value) {
            return;
        }

        onComplete({
            optionId: optionId === otherId ? null : optionId,
            otherText: optionId === otherId ? otherText.trim() : '',
            questionId: question.id,
            skipped: false,
            value,
        });
    };

    return (
        <div
            className={cn(
                'relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-clarification-border bg-clarification-bg text-sm',
                className
            )}
        >
            {showProgress ? (
                <div className="px-5 pt-5 pb-2 text-[13px] text-muted-foreground leading-none">
                    Question {currentIndex + 1} of {questions.length}
                </div>
            ) : null}
            <div className={cn('px-5 pb-1', !showProgress && 'pt-5')}>
                <h3 className="font-semibold text-[16px] text-foreground leading-snug" id={titleId}>
                    {question.title}
                </h3>
            </div>
            {question.description ? (
                <div
                    className="px-5 pt-1 pb-2 text-[13px] text-muted-foreground leading-snug"
                    id={descriptionId}
                >
                    {question.description}
                </div>
            ) : null}
            <div className="px-5 pb-2.5">
                {question.options.length > 0 ? (
                    <fieldset
                        aria-describedby={question.description ? descriptionId : undefined}
                        aria-labelledby={titleId}
                        className="relative m-0 -mx-3 flex min-w-0 flex-col gap-0.5 border-0 p-0"
                        ref={rowsContainerRef}
                    >
                        <HoverBackground activeRect={activeRect} sessionKey={sessionRef.current} />
                        {question.options.map((option, index) => (
                            <OptionButton
                                active={activeIndex === index}
                                disabled={disabled}
                                index={index}
                                key={option.id}
                                number={index + 1}
                                onBlur={() => setActiveIndex(null)}
                                onFocus={() => setActiveIndex(index)}
                                onSelect={() => {
                                    setSelection(option.id, '');
                                    complete(option.label.trim(), option.id);
                                }}
                                option={option}
                                registerItem={registerItem}
                                selected={selectedId === option.id}
                            />
                        ))}
                        {showOther ? (
                            <OtherRow
                                disabled={disabled}
                                index={question.options.length}
                                number={question.options.length + 1}
                                onChange={(value) => setSelection(otherId, value)}
                                onFocus={() => setActiveIndex(question.options.length)}
                                onSubmit={() => complete(otherText.trim(), otherId)}
                                registerItem={registerItem}
                                value={otherText}
                            />
                        ) : null}
                    </fieldset>
                ) : null}
                {question.options.length === 0 ? (
                    <fieldset
                        aria-describedby={question.description ? descriptionId : undefined}
                        aria-labelledby={titleId}
                        className="relative m-0 -mx-3 flex min-w-0 flex-col gap-0.5 border-0 p-0"
                        ref={rowsContainerRef}
                    >
                        <HoverBackground activeRect={activeRect} sessionKey={sessionRef.current} />
                        <OtherRow
                            disabled={disabled}
                            index={0}
                            label="Answer"
                            number={1}
                            onChange={(value) => setSelection(otherId, value)}
                            onFocus={() => setActiveIndex(0)}
                            onSubmit={() => complete(otherText.trim(), otherId)}
                            placeholder="Type an answer..."
                            registerItem={registerItem}
                            value={otherText}
                        />
                    </fieldset>
                ) : null}
            </div>
            {question.skippable && onSkip ? (
                <div className="flex justify-end px-5 pt-1 pb-3">
                    <button
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-clarification-row-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                        disabled={disabled}
                        onClick={() => onSkip(question)}
                        type="button"
                    >
                        {skipLabel}
                        <Icon className="size-3.5" icon={ArrowRight02Icon} strokeWidth={1.8} />
                    </button>
                </div>
            ) : null}
        </div>
    );
}

interface QuestionAnswerState {
    otherText: string;
    questionId: string | null;
    selectedId: string | null;
}

function HoverBackground({
    activeRect,
    sessionKey,
}: {
    activeRect: { height: number; left: number; top: number; width: number } | null;
    sessionKey: number;
}) {
    return (
        <AnimatePresence>
            {activeRect ? (
                <motion.div
                    animate={{
                        opacity: 1,
                        top: activeRect.top,
                        left: activeRect.left,
                        width: activeRect.width,
                        height: activeRect.height,
                    }}
                    aria-hidden="true"
                    className="pointer-events-none absolute rounded-lg bg-clarification-row-hover"
                    exit={{ opacity: 0, transition: { duration: 0.06 } }}
                    initial={{
                        opacity: 0,
                        top: activeRect.top,
                        left: activeRect.left,
                        width: activeRect.width,
                        height: activeRect.height,
                    }}
                    key={sessionKey}
                    transition={{
                        ...springs.fast,
                        opacity: { duration: 0.08 },
                    }}
                />
            ) : null}
        </AnimatePresence>
    );
}

function OptionButton({
    active,
    disabled,
    index,
    number,
    onBlur,
    onFocus,
    onSelect,
    option,
    registerItem,
    selected,
}: {
    active: boolean;
    disabled: boolean;
    index: number;
    number: number;
    onBlur: () => void;
    onFocus: () => void;
    onSelect: () => void;
    option: AskUserQuestionOption;
    registerItem: (index: number, element: HTMLElement | null) => void;
    selected: boolean;
}) {
    const showAction = active || selected;
    const rowRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        registerItem(index, rowRef.current);
        return () => registerItem(index, null);
    }, [index, registerItem]);

    return (
        <button
            className={cn(
                'relative z-10 flex min-h-10 w-full min-w-0 select-none items-center gap-3 rounded-lg py-1.5 pr-1.5 pl-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            )}
            data-proximity-index={index}
            disabled={disabled}
            onBlur={onBlur}
            onClick={onSelect}
            onFocus={onFocus}
            ref={rowRef}
            type="button"
        >
            <span className="min-w-0 flex-1 truncate text-[13px] leading-snug">
                <span className="font-medium text-foreground">{option.label}</span>
                {option.description ? (
                    <>
                        {' '}
                        <span className="text-muted-foreground">{option.description}</span>
                    </>
                ) : null}
            </span>
            <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] text-muted-foreground">
                <span className={cn('transition-opacity', showAction && 'opacity-0')}>
                    {number}
                </span>
                <span
                    className={cn(
                        'absolute inset-0 inline-flex scale-75 items-center justify-center rounded-full bg-clarification-action text-clarification-action-foreground opacity-0 transition-all',
                        showAction && 'scale-100 opacity-100'
                    )}
                >
                    <Icon className="size-3.5" icon={ArrowRight02Icon} strokeWidth={2} />
                </span>
            </span>
        </button>
    );
}

function OtherRow({
    disabled,
    index,
    label = 'Other',
    number,
    onChange,
    onFocus,
    onSubmit,
    placeholder = 'Describe in your own words...',
    registerItem,
    value,
}: {
    disabled: boolean;
    index: number;
    label?: string;
    number: number;
    onChange: (value: string) => void;
    onFocus: () => void;
    onSubmit: () => void;
    placeholder?: string;
    registerItem: (index: number, element: HTMLElement | null) => void;
    value: string;
}) {
    const canSubmit = value.trim().length > 0;
    const showAction = canSubmit;
    const rowRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        registerItem(index, rowRef.current);
        return () => registerItem(index, null);
    }, [index, registerItem]);

    return (
        <div
            className={cn(
                'relative z-10 flex min-h-10 w-full min-w-0 items-center gap-3 rounded-lg py-1.5 pr-1.5 pl-3 outline-none',
                disabled && 'opacity-60'
            )}
            data-proximity-index={index}
            ref={rowRef}
        >
            <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-snug">
                <span className="shrink-0 font-medium text-foreground">{label}</span>
                <textarea
                    aria-label={label === 'Answer' ? 'Answer' : 'Describe other answer'}
                    className="field-sizing-content min-h-0 flex-1 resize-none bg-transparent p-0 text-[13px] text-foreground leading-snug outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value)}
                    onFocus={onFocus}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            if (canSubmit) {
                                onSubmit();
                            }
                        }
                    }}
                    placeholder={placeholder}
                    rows={1}
                    value={value}
                />
            </label>
            <button
                aria-label="Send other answer"
                className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
                disabled={disabled || !canSubmit}
                onClick={onSubmit}
                type="button"
            >
                <span className={cn('transition-opacity', showAction && 'opacity-0')}>
                    {number}
                </span>
                {canSubmit ? (
                    <span
                        className={cn(
                            'absolute inset-0 inline-flex scale-75 items-center justify-center rounded-full bg-clarification-action text-clarification-action-foreground opacity-0 transition-all',
                            showAction && 'scale-100 opacity-100'
                        )}
                    >
                        <Icon className="size-3.5" icon={ArrowRight02Icon} strokeWidth={2} />
                    </span>
                ) : null}
            </button>
        </div>
    );
}
