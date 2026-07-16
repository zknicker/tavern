import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { cn } from '../../lib/utils.ts';

// Motion for prompt-bar status surfaces (the active status stack and the
// busy-elsewhere hint). Rows rise in with a scale-up + slide and float out
// the same way; a minimum dwell guarantees the cycle always completes, so a
// turn that starts and settles almost instantly never flashes.

/** Enter: springy rise with a hint of overshoot — alive, game-like. */
const riseIn = { bounce: 0.2, duration: 0.3, type: 'spring' } as const;
/** Exit: quicker settle, no bounce — the system responding, not performing. */
export const statusRiseOut = { bounce: 0, duration: 0.2, type: 'spring' } as const;
/** Height clip: never bounces, or neighbors would jitter. */
const clip = { bounce: 0, duration: 0.25, type: 'spring' } as const;

/** Minimum time a status row stays visible once shown. */
export const statusMinimumDwellMs = 1200;

/**
 * One animated status row. Render inside an `AnimatePresence` with a stable
 * key: the outer layer clips height open/closed while the inner layer scales
 * up and slides in from the composer, then floats up and away on exit.
 */
export function StatusRiseRow({
    children,
    className,
    enterDelaySeconds = 0,
    innerClassName,
}: {
    children: React.ReactNode;
    className?: string;
    /** Enter-only cascade offset for sibling rows mounting together. */
    enterDelaySeconds?: number;
    innerClassName?: string;
}) {
    const reduceMotion = useReducedMotion() === true;

    return (
        <motion.div
            animate={{ height: 'auto', opacity: 1 }}
            className={cn('overflow-hidden', className)}
            exit={{
                height: 0,
                opacity: 0,
                transition: reduceMotion
                    ? { duration: 0.15 }
                    : { height: statusRiseOut, opacity: statusRiseOut },
            }}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            transition={{
                height: { ...clip, delay: enterDelaySeconds },
                opacity: { delay: enterDelaySeconds, duration: 0.18, ease: 'easeOut' },
            }}
        >
            {/* The full transform string keeps the rise hardware-accelerated;
                Framer's scale/y shorthands run on the main thread, which is
                busiest exactly while a turn streams. */}
            <motion.div
                animate={{ transform: 'translateY(0px) scale(1)' }}
                className={innerClassName}
                exit={
                    reduceMotion
                        ? undefined
                        : {
                              transform: 'translateY(-6px) scale(0.97)',
                              transition: statusRiseOut,
                          }
                }
                initial={reduceMotion ? false : { transform: 'translateY(10px) scale(0.96)' }}
                style={{ transformOrigin: 'left center' }}
                transition={{ ...riseIn, delay: enterDelaySeconds }}
            >
                {children}
            </motion.div>
        </motion.div>
    );
}

/**
 * Blur-masked crossfade for small status content (the primary label, the
 * work icon): old and new overlap in one grid cell so nothing reflows, and
 * a 2px blur melts the double exposure into a single impression. Exit is
 * quicker than enter, matching the surface's asymmetric timing.
 */
export function StatusSwap({
    children,
    className,
    swapKey,
}: {
    children: React.ReactNode;
    className?: string;
    swapKey: string;
}) {
    const reduceMotion = useReducedMotion() === true;

    return (
        <span className={cn('grid', className)}>
            <AnimatePresence initial={false}>
                <motion.span
                    animate={{ filter: 'blur(0px)', opacity: 1 }}
                    className="col-start-1 row-start-1"
                    exit={{
                        filter: 'blur(2px)',
                        opacity: 0,
                        transition: { duration: 0.12, ease: 'easeOut' },
                    }}
                    initial={reduceMotion ? false : { filter: 'blur(2px)', opacity: 0 }}
                    key={swapKey}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                    {children}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}

const swapKeys = new WeakMap<object, string>();
let swapKeyCounter = 0;

/** Stable swap key for module-constant content values (e.g. icon objects). */
export function statusSwapKeyFor(value: object) {
    const known = swapKeys.get(value);
    if (known) {
        return known;
    }
    swapKeyCounter += 1;
    const key = `swap_${swapKeyCounter}`;
    swapKeys.set(value, key);
    return key;
}

/**
 * Keeps each item visible for at least `holdMs` after it first appears, so
 * its enter animation and a readable beat always complete before exit. Items
 * already past their dwell leave immediately (their exit still animates via
 * `AnimatePresence`); only just-appeared items are held.
 */
export function useMinimumDwell<T>(
    items: readonly T[],
    keyOf: (item: T) => string,
    holdMs: number = statusMinimumDwellMs
): readonly T[] {
    const heldRef = React.useRef(new Map<string, { item: T; shownAt: number }>());
    const [, rerender] = React.useReducer((tick: number) => tick + 1, 0);
    // Resolving during render (not in an effect) is what prevents the flash:
    // the removal render itself still shows the held row. The map mutation is
    // idempotent for a given input, so repeated renders are safe.
    const { display, nextExpiry } = resolveMinimumDwell({
        held: heldRef.current,
        holdMs,
        items,
        keyOf,
        now: Date.now(),
    });

    React.useEffect(() => {
        if (nextExpiry === null) {
            return;
        }
        const timer = setTimeout(rerender, Math.max(nextExpiry - Date.now(), 0) + 16);
        return () => clearTimeout(timer);
    }, [nextExpiry]);

    return display;
}

/** Pure dwell resolution: mutates `held` in place and returns the display list. */
export function resolveMinimumDwell<T>({
    held,
    holdMs,
    items,
    keyOf,
    now,
}: {
    held: Map<string, { item: T; shownAt: number }>;
    holdMs: number;
    items: readonly T[];
    keyOf: (item: T) => string;
    now: number;
}): { display: readonly T[]; nextExpiry: number | null } {
    const liveKeys = new Set<string>();
    for (const item of items) {
        const key = keyOf(item);
        liveKeys.add(key);
        held.set(key, { item, shownAt: held.get(key)?.shownAt ?? now });
    }

    // Emit in first-appearance order (the map's insertion order) so a held
    // row keeps its position instead of jumping below live rows.
    let nextExpiry: number | null = null;
    const display: T[] = [];
    for (const [key, entry] of held) {
        if (liveKeys.has(key)) {
            display.push(entry.item);
            continue;
        }
        const expiresAt = entry.shownAt + holdMs;
        if (expiresAt <= now) {
            held.delete(key);
        } else {
            display.push(entry.item);
            nextExpiry = nextExpiry === null ? expiresAt : Math.min(nextExpiry, expiresAt);
        }
    }

    return { display, nextExpiry };
}
