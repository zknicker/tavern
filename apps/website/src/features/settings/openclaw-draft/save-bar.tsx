import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { useOpenClawSettingsDraft } from './provider.tsx';

export function OpenClawSettingsSaveBar() {
    const { errorMessage, hasChanges, isSaving, resetAll, saveAll, validationMessage } =
        useOpenClawSettingsDraft();
    const displayedError = errorMessage ?? validationMessage;

    if (!hasChanges) {
        return null;
    }

    return (
        <div className="sticky bottom-0 z-20 mt-8 border-border/70 border-t bg-background/92 px-6 py-3 backdrop-blur">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm">Unsaved settings changes</p>
                    <p className="text-muted-foreground text-sm">
                        Save when you are done editing settings.
                    </p>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                    <Button disabled={isSaving} onClick={resetAll} type="button" variant="ghost">
                        Discard
                    </Button>
                    <Button
                        disabled={Boolean(validationMessage)}
                        loading={isSaving}
                        onClick={() => {
                            void saveAll();
                        }}
                        type="button"
                    >
                        Save changes
                    </Button>
                </div>
            </div>
            {displayedError ? (
                <div className="mx-auto mt-3 w-full max-w-5xl">
                    <Alert variant="error">
                        <Icon icon={AlertCircleIcon} />
                        <AlertDescription>{displayedError}</AlertDescription>
                    </Alert>
                </div>
            ) : null}
        </div>
    );
}
