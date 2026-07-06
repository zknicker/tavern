import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { SkillSourcesDialog } from '../../features/skills/skill-sources-dialog.tsx';
import type { HubEntry } from '../../features/skills/skill-tree-model.ts';
import { SkillsBrowser } from '../../features/skills/skills-browser.tsx';
import { SkillsPageSkeleton } from '../../features/skills/skills-page-skeleton.tsx';
import { useSkillHubAvailable } from '../../hooks/skills/use-skill-hub-available.ts';
import { useSkillList } from '../../hooks/skills/use-skill-list.ts';

export function SkillsPage() {
    const [sourcesOpen, setSourcesOpen] = React.useState(false);
    const skillsQuery = useSkillList();
    const availableQuery = useSkillHubAvailable({ enabled: true });
    const skills = skillsQuery.data?.skills ?? [];
    const hubByName = React.useMemo(() => {
        const byName = new Map<string, HubEntry>();
        for (const [identifier, entry] of Object.entries(availableQuery.data?.installed ?? {})) {
            if (entry.name) {
                byName.set(entry.name, {
                    edited: entry.edited,
                    identifier,
                    trustLevel: entry.trustLevel,
                    updateAvailable: entry.updateAvailable,
                });
            }
        }
        return byName;
    }, [availableQuery.data?.installed]);

    if (skillsQuery.isPending && !skillsQuery.data) {
        return <SkillsPageSkeleton />;
    }

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col">
            <SkillsBrowser
                available={availableQuery.data}
                availableError={availableQuery.error?.message ?? null}
                availablePending={availableQuery.isPending}
                hubByName={hubByName}
                onManageSources={() => setSourcesOpen(true)}
                skills={skills}
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
