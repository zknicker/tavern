import { useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { chromatic } from 'slot-text';
import { SlotText } from 'slot-text/react';
import { cn } from '../../lib/utils.ts';

const activeHeaderDwellMs = 280;
const slotTextHeaderLimit = 64;

export function WorkGroupHeaderText({
    isActive,
    label,
}: {
    isActive: boolean;
    label: string | null;
}) {
    const shouldReduceMotion = useReducedMotion();
    const [slotReady, setSlotReady] = React.useState(false);
    const canSlot =
        isActive &&
        shouldReduceMotion === false &&
        label !== null &&
        label.length <= slotTextHeaderLimit;

    React.useEffect(() => {
        if (!canSlot) {
            setSlotReady(false);
            return;
        }

        let cancelled = false;
        let revealFrame: number | null = null;
        const reveal = () => {
            if (!cancelled) {
                setSlotReady(true);
            }
        };

        setSlotReady(false);

        if (typeof window.requestAnimationFrame === 'function') {
            const primeFrame = window.requestAnimationFrame(() => {
                revealFrame = window.requestAnimationFrame(reveal);
            });

            return () => {
                cancelled = true;
                window.cancelAnimationFrame(primeFrame);

                if (revealFrame !== null) {
                    window.cancelAnimationFrame(revealFrame);
                }
            };
        }

        const timeout = window.setTimeout(reveal, 32);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [canSlot]);

    return (
        <WorkGroupHeaderTextView
            canSlot={canSlot}
            isActive={isActive}
            label={label}
            slotReady={slotReady}
        />
    );
}

export function WorkGroupHeaderTextView({
    canSlot,
    isActive,
    label,
    slotReady,
}: {
    canSlot: boolean;
    isActive: boolean;
    label: string | null;
    slotReady: boolean;
}) {
    if (!label) {
        return null;
    }

    const className = cn(
        'min-w-0 max-w-[28rem] truncate text-left',
        isActive && 'thinking-indicator-text'
    );

    if (!canSlot) {
        return <span className={className}>{label}</span>;
    }

    return (
        <span className={className}>
            <span className={slotReady ? 'sr-only' : undefined}>{label}</span>
            <SlotText
                aria-hidden={true}
                className={slotReady ? 'inline-flex' : 'sr-only'}
                options={slotTextOptions}
                text={label}
            />
        </span>
    );
}

const slotTextOptions = {
    bounce: 0.28,
    color: chromatic({
        from: 210,
        lightness: 62,
        saturation: 70,
        spread: 120,
    }),
    colorFade: 260,
    direction: 'up',
    duration: 220,
    interrupt: true,
    skipUnchanged: true,
    stagger: 12,
} as const;

export function useStableWorkGroupLabel(label: string | null, enabled: boolean) {
    const [stableLabel, setStableLabel] = React.useState(label);
    const stableLabelRef = React.useRef(label);
    const latestLabelRef = React.useRef(label);

    React.useEffect(() => {
        latestLabelRef.current = label;
    }, [label]);

    React.useEffect(() => {
        if (!enabled) {
            stableLabelRef.current = label;
            setStableLabel(label);
            return;
        }

        if (!label || label === stableLabelRef.current) {
            return;
        }

        if (isFallbackWorkGroupLabel(label) && stableLabelRef.current) {
            return;
        }

        if (!stableLabelRef.current || isFallbackWorkGroupLabel(stableLabelRef.current)) {
            stableLabelRef.current = label;
            setStableLabel(label);
            return;
        }

        const timeout = window.setTimeout(() => {
            const nextLabel = latestLabelRef.current;

            if (!nextLabel || isFallbackWorkGroupLabel(nextLabel)) {
                return;
            }

            stableLabelRef.current = nextLabel;
            setStableLabel(nextLabel);
        }, activeHeaderDwellMs);

        return () => window.clearTimeout(timeout);
    }, [enabled, label]);

    return stableLabel;
}

function isFallbackWorkGroupLabel(label: string) {
    return label === 'Working' || label === 'Worked';
}
