import { PencilEdit01Icon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';

interface TaskContentEditorProps {
    description: string | null;
    isSaving: boolean;
    onSaveDescription: (description: string | null) => void;
    onSaveTitle: (title: string) => void;
    title: string;
}

export function TaskContentEditor({
    description,
    isSaving,
    onSaveDescription,
    onSaveTitle,
    title,
}: TaskContentEditorProps) {
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [titleValue, setTitleValue] = React.useState(title);
    const [isEditingDescription, setIsEditingDescription] = React.useState(false);
    const [descriptionValue, setDescriptionValue] = React.useState(description ?? '');

    const saveTitle = () => {
        const trimmed = titleValue.trim();

        if (trimmed && trimmed !== title) {
            onSaveTitle(trimmed);
        } else {
            setTitleValue(title);
        }

        setIsEditingTitle(false);
    };

    const saveDescription = () => {
        const trimmed = descriptionValue.trim();

        if (trimmed !== (description ?? '')) {
            onSaveDescription(trimmed ? trimmed : null);
        }

        setIsEditingDescription(false);
    };

    return (
        <div className="flex min-w-0 flex-1 flex-col gap-5">
            {isEditingTitle ? (
                <Input
                    autoFocus
                    className="font-semibold text-xl"
                    disabled={isSaving}
                    onBlur={saveTitle}
                    onChange={(event) => setTitleValue(event.currentTarget.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            saveTitle();
                        }

                        if (event.key === 'Escape') {
                            setTitleValue(title);
                            setIsEditingTitle(false);
                        }
                    }}
                    value={titleValue}
                />
            ) : (
                <button
                    className="rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                        setTitleValue(title);
                        setIsEditingTitle(true);
                    }}
                    title="Edit title"
                    type="button"
                >
                    <h1 className="font-semibold text-2xl text-foreground">{title}</h1>
                </button>
            )}

            <div className="grid gap-2">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                        Description
                    </span>
                    {isEditingDescription ? null : (
                        <Button
                            onClick={() => {
                                setDescriptionValue(description ?? '');
                                setIsEditingDescription(true);
                            }}
                            size="xs"
                            type="button"
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" className="size-3.5" icon={PencilEdit01Icon} />
                            Edit
                        </Button>
                    )}
                </div>
                {isEditingDescription ? (
                    <div className="grid gap-2">
                        <Textarea
                            autoFocus
                            disabled={isSaving}
                            onChange={(event) => setDescriptionValue(event.currentTarget.value)}
                            rows={6}
                            value={descriptionValue}
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                onClick={() => setIsEditingDescription(false)}
                                size="sm"
                                type="button"
                                variant="secondary"
                            >
                                Cancel
                            </Button>
                            <Button
                                loading={isSaving}
                                onClick={saveDescription}
                                size="sm"
                                type="button"
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="whitespace-pre-wrap text-foreground/88 text-sm leading-6">
                        {description ?? (
                            <span className="text-muted-foreground">No description yet.</span>
                        )}
                    </p>
                )}
            </div>
        </div>
    );
}
