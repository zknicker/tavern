import { cn } from '../../lib/utils.ts';

export function CollapsibleText({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <p className={cn('whitespace-pre-wrap break-words', className)} data-selectable-text="">
            {children}
        </p>
    );
}
