import * as React from 'react';
import { SkillDetailView } from '../../features/skills/skill-detail-view.tsx';
import { SkillsPageSkeleton } from '../../features/skills/skills-page-skeleton.tsx';

export function SkillDetailPage() {
    return (
        <React.Suspense fallback={<SkillsPageSkeleton />}>
            <SkillDetailView />
        </React.Suspense>
    );
}
