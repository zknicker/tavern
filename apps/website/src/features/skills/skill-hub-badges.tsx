import { Badge } from '../../components/ui/badge.tsx';
import type { SkillHubItemOutput, SkillHubScanOutput } from '../../lib/trpc.tsx';

const sourceLabels = new Map<string, string>([
    ['browse-sh', 'browse.sh'],
    ['clawhub', 'ClawHub'],
    ['claude-marketplace', 'Claude Marketplace'],
    ['github', 'GitHub'],
    ['hermes-index', 'Index'],
    ['lobehub', 'LobeHub'],
    ['official', 'Official'],
    ['skills-sh', 'skills.sh'],
    ['url', 'URL'],
    ['well-known', 'Well-known'],
]);

export function formatSkillSourceLabel(source: string) {
    return sourceLabels.get(source) ?? source;
}

export function SkillTrustBadge({ trustLevel }: { trustLevel: SkillHubItemOutput['trustLevel'] }) {
    if (trustLevel === 'builtin') {
        return (
            <Badge size="sm" variant="info">
                Built-in
            </Badge>
        );
    }
    if (trustLevel === 'trusted') {
        return (
            <Badge size="sm" variant="success">
                Trusted
            </Badge>
        );
    }
    return (
        <Badge size="sm" variant="subtle">
            Community
        </Badge>
    );
}

export function SkillScanBadge({ scan }: { scan: SkillHubScanOutput }) {
    if (scan.policy === 'allow') {
        return (
            <Badge size="sm" variant="success">
                Scan passed
            </Badge>
        );
    }
    if (scan.policy === 'ask') {
        return (
            <Badge size="sm" variant="warning">
                Review findings
            </Badge>
        );
    }
    return (
        <Badge size="sm" variant="error">
            Blocked by scan
        </Badge>
    );
}
