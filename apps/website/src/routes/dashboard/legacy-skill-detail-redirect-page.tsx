import { Navigate, useParams } from 'react-router-dom';

export function LegacySkillDetailRedirectPage() {
    const { skillId } = useParams<{ skillId?: string }>();
    const suffix = skillId ? `/${encodeURIComponent(skillId)}` : '';

    return <Navigate replace to={`/dashboard/settings/skills${suffix}`} />;
}
