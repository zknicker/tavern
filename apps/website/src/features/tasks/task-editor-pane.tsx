import { SimpleCodeEditor } from '../../components/code-editor/simple-code-editor.tsx';
import { Field, FieldLabel } from '../../components/ui/primitives/field.tsx';
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
            <section className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-6 px-4 pt-6 pb-8 lg:max-w-4xl lg:px-10">
                <Input
                    aria-label="Task title"
                    autoFocus={autoFocusTitle}
                    className={cn(
                        editableWashClassName,
                        'shrink-0 text-foreground [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-2 [&_[data-slot=input]]:py-1 [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:text-3xl [&_[data-slot=input]]:leading-tight'
                    )}
                    onBlur={onTitleBlur}
                    onChange={(event) => onTitleChange(event.target.value)}
                    placeholder={titlePlaceholder}
                    unstyled
                    value={title}
                />
                <Field className="min-h-0 flex-1" onBlur={onDescriptionBlur}>
                    <FieldLabel>Description</FieldLabel>
                    <SimpleCodeEditor
                        className="min-h-40 rounded-lg border"
                        filePath="description.md"
                        onChange={onDescriptionChange}
                        placeholder="Context, acceptance criteria, links (Markdown supported)."
                        value={description}
                    />
                </Field>
            </section>
        </div>
    );
}
