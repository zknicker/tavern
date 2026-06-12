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
import { Spinner } from '../../components/ui/spinner.tsx';
import { useSkillHubAvailable } from '../../hooks/skills/use-skill-hub-available.ts';
import { useSkillHubTapAdd, useSkillHubTapRemove } from '../../hooks/skills/use-skill-hub-taps.ts';
import type { SkillHubAvailableOutput, SkillHubItemOutput } from '../../lib/trpc.tsx';
import { SkillHubItemList } from './skill-hub-item-list.tsx';
import { SkillHubPreview } from './skill-hub-preview.tsx';

/**
 * The Sources tab: skills come from places the user chose. Each source — the
 * engine's built-in library and the user's GitHub repos — lists its skills
 * with install state. There is no marketplace search.
 */
export function SkillSourcesTab() {
    const [selected, setSelected] = React.useState<null | SkillHubItemOutput>(null);
    const availableQuery = useSkillHubAvailable({ enabled: true });
    const available = availableQuery.data;

    if (availableQuery.isPending) {
        return (
            <div className="grid min-h-40 place-items-center">
                <Spinner className="size-5" />
            </div>
        );
    }
    if (availableQuery.error) {
        return <p className="text-error text-sm">{availableQuery.error.message}</p>;
    }
    if (!available) {
        return null;
    }

    return (
        <div className="grid gap-7">
            <AddRepoForm />

            {available.taps.map((tap) => (
                <TapSection
                    installed={available.installed}
                    key={tap.repo}
                    onSelect={setSelected}
                    tap={tap}
                />
            ))}

            <section className="grid gap-2">
                <header className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground text-sm">Built-in library</h3>
                    <span className="text-muted-foreground text-xs">
                        Optional skills maintained by the agent engine
                    </span>
                </header>
                {available.builtin.length > 0 ? (
                    <SkillHubItemList
                        installed={available.installed}
                        items={available.builtin}
                        onSelect={setSelected}
                    />
                ) : (
                    <p className="text-muted-foreground text-sm">
                        The engine install did not report a built-in skill library.
                    </p>
                )}
            </section>

            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        setSelected(null);
                    }
                }}
                open={selected !== null}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selected?.name ?? 'Skill'}</DialogTitle>
                        <DialogDescription>
                            Review the skill before installing it.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogPanel>
                        {selected ? (
                            <SkillHubPreview installed={available.installed} item={selected} />
                        ) : null}
                    </DialogPanel>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function AddRepoForm() {
    const addTap = useSkillHubTapAdd();
    const [repo, setRepo] = React.useState('');
    const canAdd = /^[\w.-]+\/[\w.-]+$/u.test(repo.trim());

    return (
        <form
            className="grid gap-2"
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
            <p className="text-muted-foreground text-sm">
                Skills come from sources you choose. Add a GitHub repo with a{' '}
                <code className="font-mono text-xs">skills/</code> folder — including private repos
                the runtime can access — then install skills from it below.
            </p>
            <div className="flex items-center gap-2">
                <Input
                    aria-label="GitHub repository"
                    className="w-full sm:max-w-xs"
                    onChange={(event) => setRepo(event.target.value)}
                    placeholder="owner/repo"
                    value={repo}
                />
                <Button disabled={!canAdd || addTap.isPending} type="submit" variant="outline">
                    {addTap.isPending ? 'Adding…' : 'Add repo'}
                </Button>
            </div>
            {addTap.error ? <p className="text-error text-sm">{addTap.error.message}</p> : null}
        </form>
    );
}

function TapSection({
    installed,
    onSelect,
    tap,
}: {
    installed: SkillHubAvailableOutput['installed'];
    onSelect: (item: SkillHubItemOutput) => void;
    tap: SkillHubAvailableOutput['taps'][number];
}) {
    const removeTap = useSkillHubTapRemove();

    return (
        <section className="grid gap-2">
            <header className="flex items-center gap-2">
                <h3 className="font-mono text-foreground text-sm">{tap.repo}</h3>
                <Button
                    className="ml-auto"
                    disabled={removeTap.isPending}
                    onClick={() => removeTap.mutate({ repo: tap.repo })}
                    size="sm"
                    variant="ghost"
                >
                    Remove repo
                </Button>
            </header>
            {tap.skills.length > 0 ? (
                <SkillHubItemList installed={installed} items={tap.skills} onSelect={onSelect} />
            ) : (
                <p className="text-muted-foreground text-sm">
                    No skills found under <code className="font-mono text-xs">{tap.path}</code>.
                    Check the repo layout or runtime GitHub access.
                </p>
            )}
            {removeTap.error ? (
                <p className="text-error text-sm">{removeTap.error.message}</p>
            ) : null}
        </section>
    );
}
