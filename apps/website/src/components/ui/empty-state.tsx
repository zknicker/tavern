import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from './empty.tsx';
import { Button } from './primitives/button.tsx';

interface EmptyStateProps {
    actionLabel?: string;
    className?: string;
    description: string;
    eyebrow?: string;
    onAction?: () => void;
    title: string;
}

export function EmptyState({
    actionLabel,
    className,
    description,
    onAction,
    title,
}: EmptyStateProps) {
    return (
        <Empty className={className}>
            <EmptyHeader>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            {actionLabel && onAction ? (
                <EmptyContent>
                    <Button onClick={onAction}>{actionLabel}</Button>
                </EmptyContent>
            ) : null}
        </Empty>
    );
}
