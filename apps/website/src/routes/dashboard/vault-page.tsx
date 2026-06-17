import * as React from 'react';
import { GridPageSkeleton } from '../../features/shell/page-skeletons.tsx';
import { Vault } from '../../features/vault/vault.tsx';

export function VaultPage() {
    return (
        <React.Suspense fallback={<GridPageSkeleton />}>
            <Vault />
        </React.Suspense>
    );
}
