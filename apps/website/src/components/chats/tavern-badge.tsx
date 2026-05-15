import { cn } from '../../lib/utils.ts';
import { Badge, CustomBadge } from '../ui/badge.tsx';

export interface TavernBadgeProps {
    className?: string;
    detail?: string | null;
}

function TavernGlyph() {
    return (
        <svg
            aria-hidden="true"
            className="size-[0.95em]"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
        >
            <path d="M7 3h10l2 18H5L7 3Z" />
            <path d="M9 7h6" />
            <path d="M10 12h4" />
            <path d="M9 16h.01" />
            <path d="M15 16h.01" />
        </svg>
    );
}

export function TavernBadge({ className, detail }: TavernBadgeProps) {
    return (
        <span className={cn('inline-flex items-center gap-1', className)}>
            <Badge className="border-transparent bg-[#df7d28] text-white" variant="secondary">
                <TavernGlyph />
                Tavern
            </Badge>
            {detail ? (
                <CustomBadge
                    className="max-w-[16rem] truncate normal-case tracking-normal"
                    title={detail}
                    variant="secondary"
                >
                    {detail}
                </CustomBadge>
            ) : null}
        </span>
    );
}
