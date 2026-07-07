import { Input } from '../../components/ui/primitives/input.tsx';
import { cn } from '../../lib/utils.ts';

interface TaskEditorPaneProps {
    autoFocusTitle?: boolean;
    description: string;
    onDescriptionBlur?: () => void;
    onDescriptionChange: (value: string) => void;
    onTitleBlur?: () => void;
    onTitleChange: (value: string) => void;
    title: string;
    titlePlaceholder: string;
}

const editableWashClassName =
    '-mx-2 block rounded-md transition-colors hover:bg-muted/55 has-focus-visible:bg-muted/55';

export function TaskEditorPane({
    autoFocusTitle = false,
    description,
    onDescriptionBlur,
    onDescriptionChange,
    onTitleBlur,
    onTitleChange,
    title,
    titlePlaceholder,
}: TaskEditorPaneProps) {
    return (
        <div className="flex min-h-0 min-w-0 flex-1">
            <main className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-4 px-4 pt-3 pb-8 lg:max-w-4xl lg:px-10">
                <Input
                    aria-label="Task title"
                    autoFocus={autoFocusTitle}
                    className={cn(
                        editableWashClassName,
                        'text-foreground [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-2 [&_[data-slot=input]]:py-1 [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:text-3xl [&_[data-slot=input]]:leading-tight'
                    )}
                    onBlur={onTitleBlur}
                    onChange={(event) => onTitleChange(event.target.value)}
                    placeholder={titlePlaceholder}
                    unstyled
                    value={title}
                />
                <textarea
                    aria-label="Task description"
                    className={cn(
                        editableWashClassName,
                        'field-sizing-content min-h-40 resize-none px-2 py-1 text-foreground/88 text-sm leading-6 outline-none placeholder:text-muted-foreground'
                    )}
                    onBlur={onDescriptionBlur}
                    onChange={(event) => onDescriptionChange(event.target.value)}
                    placeholder="Context, acceptance criteria, links (Markdown supported)."
                    value={description}
                />
            </main>
        </div>
    );
}
