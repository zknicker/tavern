import { startTransition, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../lib/utils.ts';

const DEFAULT_CHARACTER_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PARENT_TRIGGER_ATTRIBUTE = 'data-hyper-text-trigger';

type HyperTextElement = 'div' | 'li' | 'p' | 'span';

export interface HyperTextProps {
    as?: HyperTextElement;
    characterSet?: string;
    children: string;
    className?: string;
    duration?: number;
    triggerOnParent?: boolean;
}

function scrambleText(text: string, settledLength: number, characterSet: string) {
    return text
        .split('')
        .map((character, index) => {
            if (character.trim().length === 0 || index < settledLength) {
                return character;
            }

            const randomIndex = Math.floor(Math.random() * characterSet.length);

            return characterSet[randomIndex] ?? character;
        })
        .join('');
}

export function HyperText({
    as = 'span',
    children,
    className,
    duration = 800,
    characterSet = DEFAULT_CHARACTER_SET,
    triggerOnParent = false,
}: HyperTextProps) {
    const [displayText, setDisplayText] = useState(children);
    const elementId = useId();
    const frameRef = useRef<number | null>(null);
    const rootRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        setDisplayText(children);
    }, [children]);

    useEffect(() => {
        return () => {
            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const element = rootRef.current;

        if (!element) {
            return;
        }

        const trigger = triggerOnParent
            ? element.closest<HTMLElement>(`[${PARENT_TRIGGER_ATTRIBUTE}]`)
            : element;

        if (!trigger) {
            return;
        }

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        const stopAnimation = () => {
            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }

            startTransition(() => {
                setDisplayText(children);
            });
        };

        const startAnimation = () => {
            if (prefersReducedMotion.matches) {
                setDisplayText(children);
                return;
            }

            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current);
            }

            const startedAt = performance.now();

            const tick = (now: number) => {
                const progress = Math.min((now - startedAt) / duration, 1);
                const settledLength = Math.floor(progress * children.length);

                startTransition(() => {
                    setDisplayText(scrambleText(children, settledLength, characterSet));
                });

                if (progress < 1) {
                    frameRef.current = window.requestAnimationFrame(tick);
                    return;
                }

                frameRef.current = null;

                startTransition(() => {
                    setDisplayText(children);
                });
            };

            frameRef.current = window.requestAnimationFrame(tick);
        };

        trigger.addEventListener('focus', startAnimation);
        trigger.addEventListener('mouseenter', startAnimation);
        trigger.addEventListener('blur', stopAnimation);
        trigger.addEventListener('mouseleave', stopAnimation);

        return () => {
            trigger.removeEventListener('focus', startAnimation);
            trigger.removeEventListener('mouseenter', startAnimation);
            trigger.removeEventListener('blur', stopAnimation);
            trigger.removeEventListener('mouseleave', stopAnimation);

            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
    }, [characterSet, children, duration, triggerOnParent]);

    const sharedProps = {
        'aria-label': children,
        className: cn('inline-block whitespace-pre', className),
        'data-hyper-text-id': elementId,
    };

    if (as === 'div') {
        return (
            <div
                {...sharedProps}
                ref={(node) => {
                    rootRef.current = node;
                }}
            >
                {displayText}
            </div>
        );
    }

    if (as === 'li') {
        return (
            <li
                {...sharedProps}
                ref={(node) => {
                    rootRef.current = node;
                }}
            >
                {displayText}
            </li>
        );
    }

    if (as === 'p') {
        return (
            <p
                {...sharedProps}
                ref={(node) => {
                    rootRef.current = node;
                }}
            >
                {displayText}
            </p>
        );
    }

    return (
        <span
            {...sharedProps}
            ref={(node) => {
                rootRef.current = node;
            }}
        >
            {displayText}
        </span>
    );
}
