import { getModelProviderConfigFromAccessId } from '../../../lib/model-provider-config.ts';
import type { ModelAccessOutput } from '../../../lib/trpc.tsx';
import { ModelAccessProviderRow } from './model-access-provider-row.tsx';

interface CodexCredentialRowProps {
    access: ModelAccessOutput['providers'][number];
}

export function CodexCredentialRow({ access }: CodexCredentialRowProps) {
    const providerConfig = getModelProviderConfigFromAccessId('codex');

    return (
        <ModelAccessProviderRow
            color={providerConfig.color}
            description={access.description}
            descriptionPlacement="right"
            icon={providerConfig.icon}
            label={providerConfig.accessDisplayName}
            state={access.state}
        >
            {null}
        </ModelAccessProviderRow>
    );
}
