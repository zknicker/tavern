import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { AvailableSkillsList } from '../../features/skills/available-skills-list.tsx';
import { InstalledSkillsList } from '../../features/skills/installed-skills-list.tsx';
import { SkillDialog, type SkillDialogSubject } from '../../features/skills/skill-dialog.tsx';
import { SkillSourcesDialog } from '../../features/skills/skill-sources-dialog.tsx';
import { SkillsPageSkeleton } from '../../features/skills/skills-page-skeleton.tsx';
import { type SkillsTab, SkillsTabBar } from '../../features/skills/skills-tab-bar.tsx';
import { useSkillEnabledSet } from '../../hooks/skills/use-skill-enabled-set.ts';
import { useSkillHubAvailable } from '../../hooks/skills/use-skill-hub-available.ts';
import { useSkillList } from '../../hooks/skills/use-skill-list.ts';
import type { SkillHubItemOutput, SkillListOutput } from '../../lib/trpc.tsx';

export function SkillsPage() {
    const [tab, setTab] = React.useState<SkillsTab>('installed');
    const [sourcesOpen, setSourcesOpen] = React.useState(false);
    const [subject, setSubject] = React.useState<null | SkillDialogSubject>(null);
    const setSkillEnabled = useSkillEnabledSet();
    const skillsQuery = useSkillList();
    const availableQuery = useSkillHubAvailable({ enabled: true });
    const skills = skillsQuery.data?.skills ?? [];
    const hubByName = React.useMemo(() => {
        const byName = new Map<string, { identifier: string; trustLevel: null | string }>();
        for (const [identifier, entry] of Object.entries(availableQuery.data?.installed ?? {})) {
            if (entry.name) {
                byName.set(entry.name, { identifier, trustLevel: entry.trustLevel });
            }
        }
        return byName;
    }, [availableQuery.data?.installed]);
    const savingSkillIds = React.useMemo(
        () =>
            setSkillEnabled.isPending && setSkillEnabled.variables
                ? new Set([setSkillEnabled.variables.skillId])
                : new Set<string>(),
        [setSkillEnabled.isPending, setSkillEnabled.variables]
    );
    const liveSubject = subject ? refreshSubject(subject, skills, hubByName) : null;

    if (skillsQuery.isPending && !skillsQuery.data) {
        return <SkillsPageSkeleton />;
    }

    return (
        <div>
            <section className="grid gap-4">
                <BadgeDivider className="pb-4">Skills</BadgeDivider>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <SkillsTabBar
                        counts={{ installed: skills.length }}
                        onChange={setTab}
                        value={tab}
                    />
                    <Button
                        className="shrink-0 sm:ml-auto"
                        onClick={() => setSourcesOpen(true)}
                        variant="outline"
                    >
                        Manage sources
                    </Button>
                </div>

                {tab === 'installed' ? (
                    <InstalledSkillsList
                        onSelect={(skill) => setSubject(installedSubject(skill, hubByName))}
                        onSetEnabled={(input) => setSkillEnabled.mutate(input)}
                        savingSkillIds={savingSkillIds}
                        skills={skills}
                    />
                ) : (
                    <AvailableSkillsList
                        onSelect={(item) => setSubject(availableSubject(item, skills, hubByName))}
                    />
                )}
            </section>

            <SkillDialog
                onOpenChange={(open) => {
                    if (!open) {
                        setSubject(null);
                    }
                }}
                subject={liveSubject}
            />
            <SkillSourcesDialog onOpenChange={setSourcesOpen} open={sourcesOpen} />

            {skillsQuery.error ? (
                <div className="fixed inset-x-4 bottom-4 z-50">
                    <Alert variant="error">
                        <Icon icon={AlertCircleIcon} />
                        <AlertDescription>{skillsQuery.error.message}</AlertDescription>
                    </Alert>
                </div>
            ) : null}
        </div>
    );
}

type SkillSummary = SkillListOutput['skills'][number];
type HubByName = Map<string, { identifier: string; trustLevel: null | string }>;

function installedSubject(skill: SkillSummary, hubByName: HubByName): SkillDialogSubject {
    const hubEntry = hubByName.get(skill.name);
    return {
        description: skill.description,
        enabled: skill.enabled,
        identifier: hubEntry?.identifier ?? null,
        installed: true,
        name: skill.name,
        skillId: skill.id,
        trustLevel: narrowTrustLevel(hubEntry?.trustLevel),
        uninstallName: hubEntry ? skill.name : null,
    };
}

function availableSubject(
    item: SkillHubItemOutput,
    skills: SkillSummary[],
    hubByName: HubByName
): SkillDialogSubject {
    const installedEntry = hubByName.get(item.name);
    const inventorySkill = installedEntry
        ? skills.find((skill) => skill.name === item.name)
        : undefined;
    return {
        description: item.description || null,
        enabled: inventorySkill?.enabled,
        identifier: item.identifier,
        installed: installedEntry !== undefined,
        name: item.name,
        skillId: inventorySkill?.id ?? null,
        trustLevel: item.trustLevel,
        uninstallName: installedEntry ? item.name : null,
    };
}

/**
 * Recompute install/enable state from fresh query data so the open dialog
 * tracks installs, uninstalls, and toggles instead of showing stale state.
 */
function refreshSubject(
    subject: SkillDialogSubject,
    skills: SkillSummary[],
    hubByName: HubByName
): SkillDialogSubject {
    const hubEntry = hubByName.get(subject.name);
    const inventorySkill = skills.find((skill) => skill.name === subject.name);
    const installed = inventorySkill !== undefined || hubEntry !== undefined;
    return {
        ...subject,
        enabled: inventorySkill?.enabled ?? subject.enabled,
        identifier: subject.identifier ?? hubEntry?.identifier ?? null,
        installed,
        skillId: inventorySkill?.id ?? null,
        uninstallName: hubEntry ? subject.name : null,
    };
}

function narrowTrustLevel(value: null | string | undefined) {
    return value === 'builtin' || value === 'community' || value === 'trusted' ? value : undefined;
}
