import { TavernVaultBadge } from '../../../components/badges/tavern-vault-badge.tsx';

type ConnectionState = 'error' | 'live' | 'needs-auth';
export type ConnectionTarget = 'tavern-vault';

interface ProviderConnectionDescriptionProps {
    description: string;
    state: ConnectionState;
    target?: ConnectionTarget;
}

export function ProviderConnectionDescription({
    description,
    state,
    target,
}: ProviderConnectionDescriptionProps) {
    if (state === 'live' && target) {
        return (
            <div className="flex items-center gap-1 text-meta text-muted-foreground">
                <span>Connected to</span>
                <ConnectionTargetLabel target={target} />
            </div>
        );
    }

    return (
        <div
            className={
                state === 'error' ? 'text-destructive text-meta' : 'text-meta text-muted-foreground'
            }
        >
            {description}
        </div>
    );
}

function ConnectionTargetLabel(_props: { target: ConnectionTarget }) {
    return <TavernVaultBadge />;
}
