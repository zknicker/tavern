import { Card } from '../../components/ui/card.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { getToolMentionAppearance } from './tool-mention-registry.tsx';
import type { ToolMentionOption } from './tool-mention-types.ts';

export function ToolMentionPicker({
    activeIndex,
    className,
    onSelect,
    options,
}: {
    activeIndex: number;
    className?: string;
    onSelect: (option: ToolMentionOption) => void;
    options: ToolMentionOption[];
}) {
    if (options.length === 0) {
        return null;
    }

    return (
        <Card
            className={cn(
                'absolute right-0 bottom-[calc(100%+0.35rem)] left-0 z-20 max-h-48 overflow-y-auto rounded-2xl border-border/65 bg-popover/88 p-1 shadow-black/8 shadow-lg backdrop-blur-xl',
                className
            )}
            role="listbox"
        >
            {options.map((option, index) => {
                const appearance = getToolMentionAppearance(option);

                return (
                    <button
                        aria-selected={index === activeIndex}
                        className={cn(
                            'flex h-9 w-full min-w-0 items-center gap-2 rounded-xl px-3 text-left text-[13px] text-muted-foreground transition-colors',
                            index === activeIndex
                                ? 'bg-accent/55 text-foreground'
                                : 'hover:bg-accent/40 hover:text-foreground'
                        )}
                        key={`${option.kind}:${option.id}`}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            onSelect(option);
                        }}
                        role="option"
                        type="button"
                    >
                        <span className="flex size-5 shrink-0 items-center justify-center text-foreground/70">
                            <Icon icon={appearance.icon} size={16} />
                        </span>
                        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                            <span className="min-w-0 max-w-[45%] truncate font-medium text-foreground">
                                {option.label}
                            </span>
                            {option.description ? (
                                <span className="min-w-0 truncate text-muted-foreground">
                                    {option.description}
                                </span>
                            ) : null}
                        </span>
                        {option.sourceLabel ? (
                            <span className="shrink-0 text-muted-foreground">
                                {option.sourceLabel}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </Card>
    );
}
