import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { SkillsCatalog } from '../../features/skills/skills-catalog.tsx';
import { SkillsPageSkeleton } from '../../features/skills/skills-page-skeleton.tsx';
import { useSkillList } from '../../hooks/skills/use-skill-list.ts';

export function SkillsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const skillsQuery = useSkillList();
    const skills = skillsQuery.data?.skills ?? [];
    const legacySkillId = searchParams.get('skill');

    React.useEffect(() => {
        if (!legacySkillId) {
            return;
        }

        navigate(`/dashboard/skills/${encodeURIComponent(legacySkillId)}`, { replace: true });
    }, [legacySkillId, navigate]);

    if (skillsQuery.isPending && !skillsQuery.data) {
        return <SkillsPageSkeleton />;
    }

    return (
        <div className="flex h-full min-h-0 bg-background">
            <SkillsCatalog
                onOpenSkill={(skillId) => {
                    navigate(`/dashboard/skills/${encodeURIComponent(skillId)}`);
                }}
                skills={skills}
            />

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
