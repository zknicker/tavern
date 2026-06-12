import { CubeIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { EmptyState } from '../shell/empty-state.tsx';
import { formatSkillName } from './skill-name-format.ts';

type SkillSummary = SkillListOutput['skills'][number];

export function InstalledSkillsList({
    onSelect,
    onSetEnabled,
    savingSkillIds,
    skills,
}: {
    onSelect: (skill: SkillSummary) => void;
    onSetEnabled: (input: { enabled: boolean; skillId: string }) => void;
    savingSkillIds: Set<string>;
    skills: SkillSummary[];
}) {
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const visibleSkills = filterSkills(skills, deferredSearch);

    return (
        <div className="grid gap-4">
            <SearchInput
                aria-label="Search installed skills"
                className="w-full sm:max-w-xs"
                name="skill-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search skills..."
                value={search}
            />

            {visibleSkills.length > 0 ? (
                <div className="grid gap-2">
                    {visibleSkills.map((skill) => (
                        <SkillRow
                            key={skill.id}
                            onSelect={() => onSelect(skill)}
                            onSetEnabled={(enabled) => onSetEnabled({ enabled, skillId: skill.id })}
                            saving={savingSkillIds.has(skill.id)}
                            skill={skill}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState
                    className="py-16"
                    description={
                        search.trim().length > 0
                            ? 'Try a different name or description.'
                            : 'Install skills from the Available tab.'
                    }
                    title={search.trim().length > 0 ? 'No matches' : 'No skills installed'}
                />
            )}
        </div>
    );
}

function SkillRow({
    onSelect,
    onSetEnabled,
    saving,
    skill,
}: {
    onSelect: () => void;
    onSetEnabled: (enabled: boolean) => void;
    saving: boolean;
    skill: SkillSummary;
}) {
    const needsSetup = skill.enabled && skill.dependencyState === 'missing';

    return (
        <div className="flex items-center gap-3 rounded-xl border border-border/70 pr-4 transition-colors hover:border-border-strong">
            <button
                className={cn(
                    'flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    !skill.enabled && 'opacity-50'
                )}
                onClick={onSelect}
                type="button"
            >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground">
                    <Icon className="size-4" icon={CubeIcon} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-foreground text-sm">
                            {formatSkillName(skill.name)}
                        </span>
                        {needsSetup ? (
                            <Badge size="sm" variant="error">
                                {skill.diagnostic ?? 'Needs setup'}
                            </Badge>
                        ) : null}
                    </span>
                    <span className="mt-1 line-clamp-1 text-muted-foreground text-sm">
                        {skill.description ?? skill.id}
                    </span>
                </span>
            </button>
            <Switch
                aria-label={`${skill.enabled ? 'Disable' : 'Enable'} ${skill.name}`}
                checked={skill.enabled}
                disabled={saving}
                onCheckedChange={onSetEnabled}
            />
        </div>
    );
}

function filterSkills(skills: SkillSummary[], search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return skills;
    }
    return skills.filter((skill) =>
        [skill.name, skill.description, skill.id, skill.diagnostic].some((value) =>
            (value ?? '').toLowerCase().includes(normalized)
        )
    );
}
