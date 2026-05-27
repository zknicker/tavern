import { getModelProviderConfigFromAccessId } from '../../../lib/model-provider-config.ts';
import type { ModelAccessOutput } from '../../../lib/trpc.tsx';
import { ModelAccessProviderRow } from './model-access-provider-row.tsx';

interface CodexCredentialRowProps {
    access: ModelAccessOutput['providers'][number];
}

export function CodexCredentialRow({ access }: CodexCredentialRowProps) {
    const providerConfig = getModelProviderConfigFromAccessId('codex');
    const label = providerConfig.accessDisplayName;

    return (
        <ModelAccessProviderRow
            color={providerConfig.color}
            description={access.description}
            icon={providerConfig.icon}
            label={label}
            state={access.state}
        >
            {null}
        </ModelAccessProviderRow>
    );
}
