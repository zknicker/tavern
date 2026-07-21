import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { useStore } from '@tanstack/react-form';
import { SimpleCodeEditor } from '../../components/code-editor/simple-code-editor.tsx';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Field, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import type { CronEditorFormApi } from './use-cron-editor-form.ts';

interface CronEditorPromptPaneProps {
    errorMessage: string | null;
    form: CronEditorFormApi;
}

export function CronEditorPromptPane({ errorMessage, form }: CronEditorPromptPaneProps) {
    const runType = useStore(form.store, (state) => state.values.runType);

    return (
        <div className="flex min-h-0 min-w-0 flex-1">
            <section className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-6 px-4 pt-6 pb-8 lg:max-w-4xl lg:px-10">
                <div className="flex shrink-0 flex-col gap-1">
                    <form.Field name="name">
                        {(field) => (
                            <Input
                                aria-label="Reminder name"
                                className="-mx-2 block rounded-md text-foreground transition-colors hover:bg-muted/55 has-focus-visible:bg-muted/55 [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-2 [&_[data-slot=input]]:py-1 [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:text-3xl [&_[data-slot=input]]:leading-tight"
                                onBlur={field.handleBlur}
                                onChange={(event) => field.handleChange(event.target.value)}
                                placeholder="Untitled reminder"
                                unstyled
                                value={field.state.value}
                            />
                        )}
                    </form.Field>
                    <form.Field name="description">
                        {(field) => (
                            <Input
                                aria-label="Reminder description"
                                className="-mx-2 block rounded-md text-muted-foreground transition-colors hover:bg-muted/55 has-focus-visible:bg-muted/55 has-focus-visible:text-foreground [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-2 [&_[data-slot=input]]:py-1 [&_[data-slot=input]]:text-base"
                                onBlur={field.handleBlur}
                                onChange={(event) => field.handleChange(event.target.value)}
                                placeholder="Add a description"
                                unstyled
                                value={field.state.value}
                            />
                        )}
                    </form.Field>
                </div>

                {errorMessage ? (
                    <Alert variant="error">
                        <Icon icon={AlertCircleIcon} />
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                ) : null}

                {runType === 'systemEvent' ? (
                    <form.Field name="systemEventText">
                        {(field) => (
                            <Field className="min-h-0 flex-1">
                                <FieldLabel>System event</FieldLabel>
                                <SimpleCodeEditor
                                    className="min-h-40 rounded-lg border"
                                    filePath="system-event.md"
                                    onChange={(value) => field.handleChange(value)}
                                    value={field.state.value}
                                />
                            </Field>
                        )}
                    </form.Field>
                ) : runType === 'script' ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-4">
                        <form.Field name="scriptCommand">
                            {(field) => (
                                <Field className="min-h-0 flex-1">
                                    <FieldLabel>Script</FieldLabel>
                                    <SimpleCodeEditor
                                        className="min-h-40 rounded-lg border"
                                        filePath="watchdog.sh"
                                        onChange={(value) => field.handleChange(value)}
                                        value={field.state.value}
                                    />
                                    <p className="text-muted-foreground text-sm">
                                        Runs without the agent. Anything the script prints is
                                        delivered into the chat and wakes the agent; print nothing
                                        for a quiet tick that only shows up in run history.
                                    </p>
                                </Field>
                            )}
                        </form.Field>
                        <form.Field name="scriptWorkingDir">
                            {(field) => (
                                <Field className="shrink-0">
                                    <FieldLabel>Working directory</FieldLabel>
                                    <Input
                                        onBlur={field.handleBlur}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                        placeholder="Agent workspace (default)"
                                        value={field.state.value}
                                    />
                                </Field>
                            )}
                        </form.Field>
                    </div>
                ) : (
                    <form.Field name="message">
                        {(field) => (
                            <Field className="min-h-0 flex-1">
                                <FieldLabel>Prompt</FieldLabel>
                                <SimpleCodeEditor
                                    className="min-h-40 rounded-lg border"
                                    filePath="prompt.md"
                                    onChange={(value) => field.handleChange(value)}
                                    value={field.state.value}
                                />
                            </Field>
                        )}
                    </form.Field>
                )}
            </section>
        </div>
    );
}
