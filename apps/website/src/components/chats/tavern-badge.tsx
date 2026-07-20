import { cn } from '../../lib/utils.ts';
import { Badge, CustomBadge } from '../ui/badge.tsx';

export interface TavernBadgeProps {
    className?: string;
    detail?: string | null;
}

function TavernGlyph() {
    return (
        <svg aria-hidden="true" className="size-[0.95em]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.9 4.6c-.9 0-1.8.4-2.3 1.1-.6.7-.8 1.7-.6 2.6l.5 2.4c.1.6.1 1.3-.2 1.9l-.5 1.2c-.4 1-.3 2.1.3 3 .6.8 1.6 1.3 2.7 1.2l2.1-.1c.7-.1 1.5.1 2.1.4l2.3 1.5c.8.6 1.7.8 2.7.5.9-.2 1.7-.9 2-1.8l1.1-2.2c.1-.4.3-.7.6-1l1.9-2.1c.6-.6.9-1.5.8-2.4-.1-.8-.5-1.6-1.2-2.1l-1.4-1.1c-.6-.4-1-1.1-1.1-1.8l-.2-1.3c-.2-.9-.7-1.7-1.6-2.1-.8-.4-1.8-.4-2.6 0l-3.7 1.8c-.4.2-.9.3-1.3.3Z" />
            <path
                d="M8.1 9.7c.2-1 1-1.6 2-1.6s1.8.6 2 1.6c.2 1 .2 3.4 0 4.4-.2 1-1 1.6-2 1.6s-1.8-.6-2-1.6c-.2-1-.2-3.4 0-4.4Zm5.8 0c.2-1 1-1.6 2-1.6s1.8.6 2 1.6c.2 1 .2 3.4 0 4.4-.2 1-1 1.6-2 1.6s-1.8-.6-2-1.6c-.2-1-.2-3.4 0-4.4Z"
                fill="#180b02"
            />
            <path
                d="M9.2 9.4c.4-.3 1-.3 1.4 0 .3.4.3 1.7 0 2.1-.4.3-1 .3-1.4 0-.3-.4-.3-1.7 0-2.1Zm5.8 0c.4-.3 1-.3 1.4 0 .3.4.3 1.7 0 2.1-.4.3-1 .3-1.4 0-.3-.4-.3-1.7 0-2.1Z"
                fill="#fff"
            />
        </svg>
    );
}

export function TavernBadge({ className, detail }: TavernBadgeProps) {
    return (
        <span className={cn('inline-flex items-center gap-1', className)}>
            <Badge className="border-transparent bg-[#df7d28] text-white" variant="secondary">
                <TavernGlyph />
                Grotto
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
