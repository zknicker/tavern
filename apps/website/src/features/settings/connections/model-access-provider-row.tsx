import type { IconSvgElement } from '@hugeicons/react';
import type { ReactNode } from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { FieldError } from '../../../components/ui/primitives/field.tsx';
import { SettingsItem } from '../../../components/ui/settings-row.tsx';
import type { ModelAccessOutput } from '../../../lib/trpc.tsx';
import { ProviderConnectionDescription } from './provider-connection-description.tsx';

interface ModelAccessProviderRowProps {
    children: ReactNode;
    color: string;
    description: string;
    error?: string | null;
    icon: IconSvgElement;
    label: string;
    state: ModelAccessOutput['providers'][number]['state'];
    target?: 'tavern-vault';
}

export function ModelAccessProviderRow({
    children,
    color,
    description,
    error = null,
    icon,
    label,
    state,
    target,
}: ModelAccessProviderRowProps) {
    return (
        <SettingsItem className="grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(18rem,32rem)] md:items-center md:gap-6">
            <div className="flex min-w-0 items-center gap-3">
                <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                        backgroundColor: `${color}1A`,
                        color,
                    }}
                >
                    <Icon className="size-5" icon={icon} />
                </span>
                <div className="min-w-0 space-y-0.5">
                    <h3 className="truncate font-medium text-foreground text-sm">{label}</h3>
                    <ProviderConnectionDescription
                        description={description}
                        state={state}
                        target={target}
                    />
                </div>
            </div>

            <div className="min-w-0 space-y-2 md:w-full md:justify-self-end">
                <div className="flex justify-start gap-2 md:justify-end">{children}</div>
                {error ? <FieldError>{error}</FieldError> : null}
            </div>
        </SettingsItem>
    );
}
