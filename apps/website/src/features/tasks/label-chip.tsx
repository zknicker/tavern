import type { TaskLabelColor } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { taskLabelChipClass, taskLabelDotClass } from './label-colors.ts';

// A colored label pill for board rows and pickers. Not the shared Badge: labels
// own their palette rather than the badge status variants.
export function LabelChip({ color, name }: { color: TaskLabelColor; name: string }) {
    return (
        <span
            className={cn(
                'inline-flex max-w-40 items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium text-xs',
                taskLabelChipClass[color]
            )}
        >
            <span className={cn('size-1.5 shrink-0 rounded-full', taskLabelDotClass[color])} />
            <span className="truncate">{name}</span>
        </span>
    );
}

// A bare color dot for select rows and swatch buttons.
export function LabelDot({ className, color }: { className?: string; color: TaskLabelColor }) {
    return (
        <span
            className={cn('size-2.5 shrink-0 rounded-full', taskLabelDotClass[color], className)}
        />
    );
}
