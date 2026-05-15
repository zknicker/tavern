import { TypeCursorIcon } from '@hugeicons-pro/core-stroke-rounded';
import { forwardRef, type HTMLAttributes, useEffect, useState } from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';

const circleA =
    'M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z';
const infinity =
    'M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z';
const circleB =
    'M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z';

const words = ['Thinking', 'Planning', 'Refining'];
const longestWord = words.reduce((current, word) =>
    current.length >= word.length ? current : word
);
const pathValues = [circleA, infinity, circleB, infinity, circleA].join(';');
const pathKeySplines = ['0.4 0 0.2 1', '0.4 0 0.2 1', '0.4 0 0.2 1', '0.4 0 0.2 1'].join(';');

function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setPrefersReducedMotion(query.matches);

        update();
        query.addEventListener('change', update);

        return () => query.removeEventListener('change', update);
    }, []);

    return prefersReducedMotion;
}

export const ThinkingIndicator = forwardRef<HTMLOutputElement, HTMLAttributes<HTMLOutputElement>>(
    ({ className, ...props }, ref) => {
        const [index, setIndex] = useState(0);
        const prefersReducedMotion = usePrefersReducedMotion();

        useEffect(() => {
            if (prefersReducedMotion) {
                return;
            }

            const interval = window.setInterval(() => {
                setIndex((current) => (current + 1) % words.length);
            }, 4000);

            return () => window.clearInterval(interval);
        }, [prefersReducedMotion]);

        return (
            <output
                aria-live="polite"
                className={cn('flex w-fit items-center gap-2 px-3 py-2', className)}
                ref={ref}
                {...props}
            >
                <svg
                    aria-hidden={true}
                    className="size-5 shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                >
                    <path d={circleA}>
                        {prefersReducedMotion ? null : (
                            <animate
                                attributeName="d"
                                calcMode="spline"
                                dur="6s"
                                keySplines={pathKeySplines}
                                keyTimes="0;0.25;0.5;0.75;1"
                                repeatCount="indefinite"
                                values={pathValues}
                            />
                        )}
                    </path>
                </svg>
                <span className="inline-grid overflow-hidden font-medium text-meta">
                    <span
                        aria-hidden={true}
                        className="thinking-indicator-text invisible col-start-1 row-start-1"
                    >
                        {longestWord}
                    </span>
                    <span
                        className="thinking-indicator-text thinking-indicator-word col-start-1 row-start-1"
                        key={words[index]}
                    >
                        {words[index]}
                    </span>
                </span>
            </output>
        );
    }
);

ThinkingIndicator.displayName = 'ThinkingIndicator';

export const TypingIndicator = forwardRef<HTMLOutputElement, HTMLAttributes<HTMLOutputElement>>(
    ({ className, ...props }, ref) => {
        const [dotCount, setDotCount] = useState(1);
        const prefersReducedMotion = usePrefersReducedMotion();

        useEffect(() => {
            if (prefersReducedMotion) {
                return;
            }

            const interval = window.setInterval(() => {
                setDotCount((current) => (current % 3) + 1);
            }, 420);

            return () => window.clearInterval(interval);
        }, [prefersReducedMotion]);

        const dots = '.'.repeat(dotCount);

        return (
            <output
                aria-live="polite"
                className={cn('flex w-fit items-center gap-2 px-3 py-2', className)}
                ref={ref}
                {...props}
            >
                <Icon
                    aria-hidden={true}
                    className="size-5 shrink-0 text-muted-foreground"
                    icon={TypeCursorIcon}
                    strokeWidth={1.6}
                />
                <span className="inline-grid overflow-hidden font-medium text-meta">
                    <span
                        aria-hidden={true}
                        className="thinking-indicator-text invisible col-start-1 row-start-1"
                    >
                        Typing...
                    </span>
                    <span className="thinking-indicator-text thinking-indicator-word col-start-1 row-start-1">
                        {`Typing${dots}`}
                    </span>
                </span>
            </output>
        );
    }
);

TypingIndicator.displayName = 'TypingIndicator';
