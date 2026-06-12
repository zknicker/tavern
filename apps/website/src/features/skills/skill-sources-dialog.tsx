import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import {
    useSkillHubTapAdd,
    useSkillHubTapRemove,
    useSkillHubTaps,
} from '../../hooks/skills/use-skill-hub-taps.ts';

export function SkillSourcesDialog({
    onOpenChange,
    open,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const tapsQuery = useSkillHubTaps({ enabled: open });
    const addTap = useSkillHubTapAdd();
    const removeTap = useSkillHubTapRemove();
    const [repo, setRepo] = React.useState('');
    const taps = tapsQuery.data?.taps ?? [];
    const canAdd = /^[\w.-]+\/[\w.-]+$/u.test(repo.trim());

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Skill sources</DialogTitle>
                    <DialogDescription>
                        Add GitHub repos with a <code className="font-mono text-xs">skills/</code>{' '}
                        folder — including private repos the runtime can access. Their skills appear
                        on the Available tab.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="grid gap-3">
                    <form
                        className="flex items-center gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!canAdd) {
                                return;
                            }
                            addTap.mutate(
                                { path: 'skills/', repo: repo.trim() },
                                { onSuccess: () => setRepo('') }
                            );
                        }}
                    >
                        <Input
                            aria-label="GitHub repository"
                            className="flex-1"
                            onChange={(event) => setRepo(event.target.value)}
                            placeholder="owner/repo"
                            value={repo}
                        />
                        <Button
                            disabled={!canAdd || addTap.isPending}
                            type="submit"
                            variant="outline"
                        >
                            {addTap.isPending ? 'Adding…' : 'Add repo'}
                        </Button>
                    </form>
                    {addTap.error ? (
                        <p className="text-error text-sm">{addTap.error.message}</p>
                    ) : null}

                    {taps.map((tap) => (
                        <div
                            className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-2.5"
                            key={tap.repo}
                        >
                            <span className="min-w-0 flex-1 truncate font-mono text-foreground text-sm">
                                {tap.repo}
                            </span>
                            <Button
                                disabled={removeTap.isPending}
                                onClick={() => removeTap.mutate({ repo: tap.repo })}
                                size="sm"
                                variant="ghost"
                            >
                                Remove
                            </Button>
                        </div>
                    ))}
                    {taps.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No repos yet. Skills you install stay installed even if you remove their
                            repo later.
                        </p>
                    ) : null}
                    {removeTap.error ? (
                        <p className="text-error text-sm">{removeTap.error.message}</p>
                    ) : null}
                </DialogPanel>
            </DialogContent>
        </Dialog>
    );
}
