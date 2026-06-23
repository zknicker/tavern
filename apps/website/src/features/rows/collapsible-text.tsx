import { cn } from '../../lib/utils.ts';

export function CollapsibleText({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('whitespace-pre-wrap break-words', className)} data-selectable-text="">
            {children}
        </div>
    );
}
