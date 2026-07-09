import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils.ts';

// A small pulsing dot marking a task with a live dispatched turn. The ring
// animates on transform + opacity only (Fluid Functionalism), so it stays cheap
// on a board of many rows and collapses to a static dot when motion is reduced.
export function TaskActivityIndicator({ className, label }: { className?: string; label: string }) {
    const reduceMotion = useReducedMotion();

    return (
        <output
            aria-label={label}
            className={cn(
                'relative inline-flex size-2 shrink-0 items-center justify-center',
                className
            )}
        >
            {reduceMotion ? null : (
                <motion.span
                    animate={{ opacity: [0.55, 0], scale: [1, 2.4] }}
                    className="pointer-events-none absolute inset-0 rounded-full bg-info"
                    transition={{
                        duration: 1.6,
                        ease: 'easeOut',
                        repeat: Number.POSITIVE_INFINITY,
                    }}
                />
            )}
            <span className="relative size-2 rounded-full bg-info" />
        </output>
    );
}
