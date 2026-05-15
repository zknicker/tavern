import { Plus } from '@hugeicons/core-free-icons';
import { ZapIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { CardStack, CardStackItem } from '../../components/ui/card-stack.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { SaveToast } from '../../components/ui/save-toast.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { useSaveToast } from '../../hooks/use-save-toast.ts';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { InstallSkillDialog } from './skill-install-panel.tsx';

type SkillSummary = SkillListOutput['skills'][number];

export function SkillsCatalog({
    onOpenSkill,
    skills,
}: {
    onOpenSkill: (skillId: string) => void;
    skills: SkillListOutput['skills'];
}) {
    const [installDialogOpen, setInstallDialogOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const { showSuccessToast, toast } = useSaveToast();
    const visibleSkills = filterSkills(skills, deferredSearch);
    const hasSearch = search.trim().length > 0;

    const handleInstalled = React.useCallback(
        (skillId: string) => {
            setInstallDialogOpen(false);
            showSuccessToast('Installed skill.');
            onOpenSkill(skillId);
        },
        [onOpenSkill, showSuccessToast]
    );

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex justify-end px-5 py-3">
                <Button
                    className="w-full sm:w-auto"
                    onClick={() => setInstallDialogOpen(true)}
                    type="button"
                    variant="secondary"
                >
                    <Icon aria-hidden="true" icon={Plus} />
                    Add Skill
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="text-muted-foreground text-sm tabular-nums">
                            {skills.length} skills
                        </div>
                        <SearchInput
                            aria-label="Search skills"
                            className="w-full sm:ml-auto sm:max-w-xs"
                            name="skill-search"
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search skills..."
                            value={search}
                        />
                    </div>

                    {visibleSkills.length > 0 ? (
                        <CardStack>
                            {visibleSkills.map((skill) => (
                                <SkillCard
                                    key={skill.id}
                                    onOpen={() => onOpenSkill(skill.id)}
                                    skill={skill}
                                />
                            ))}
                        </CardStack>
                    ) : (
                        <EmptyState
                            actionLabel={hasSearch ? undefined : 'Add Skill'}
                            className="py-16"
                            description={
                                hasSearch
                                    ? 'Try a different name, source, or description.'
                                    : 'Install a skill from ClawHub or GitHub to make it available to your agent.'
                            }
                            onAction={hasSearch ? undefined : () => setInstallDialogOpen(true)}
                            title={hasSearch ? 'No skills match' : 'No skills yet'}
                        />
                    )}
                </div>
            </ScrollArea>

            <InstallSkillDialog
                onInstalled={handleInstalled}
                onOpenChange={setInstallDialogOpen}
                open={installDialogOpen}
            />
            {toast ? <SaveToast message={toast.message} variant={toast.variant} /> : null}
        </div>
    );
}

function filterSkills(skills: SkillSummary[], search: string) {
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch.length === 0) {
        return skills;
    }

    return skills.filter((skill) =>
        [
            skill.name,
            skill.description,
            skill.installSource?.source,
            skill.installSource?.spec,
        ].some((value) => (value ?? '').toLowerCase().includes(normalizedSearch))
    );
}

function formatSkillSource(skill: SkillSummary) {
    if (!skill.installSource) {
        return 'Tavern';
    }
    if (skill.installSource.source === 'clawhub') {
        return `ClawHub / ${skill.installSource.spec}`;
    }
    return skill.installSource.spec;
}

function formatAgentCount(count: number) {
    return count > 0 ? 'Assigned' : 'Not assigned';
}

function SkillCard({ onOpen, skill }: { onOpen: () => void; skill: SkillSummary }) {
    return (
        <CardStackItem onOpen={onOpen} openLabel={`Open ${skill.name}`}>
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground">
                <Icon className="size-4" icon={ZapIcon} />
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground text-sm">{skill.name}</p>
                        {skill.updateAvailable ? (
                            <Badge size="sm" variant="warning">
                                Update
                            </Badge>
                        ) : null}
                    </div>
                    <p className="mt-1 truncate text-muted-foreground text-sm">
                        {skill.description ?? skill.id}
                    </p>
                </div>

                <div className="hidden shrink-0 items-center gap-3 text-muted-foreground text-sm md:flex">
                    <span className="max-w-36 truncate">{formatSkillSource(skill)}</span>
                    <span className="tabular-nums">{formatAgentCount(skill.agentCount)}</span>
                </div>
            </div>
        </CardStackItem>
    );
}
