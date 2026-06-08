import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import {
    getMentionAppearance,
    getMentionDisplayLabel,
    getMentionIconToneClassName,
    getMentionTextToneClassName,
    MentionAppearanceIcon,
} from './mention-appearance.tsx';
import type { MentionKind } from './mention-types.ts';

export function MentionChip({
    className,
    id,
    kind,
    label,
    metadata,
}: {
    className?: string;
    id: string;
    kind: MentionKind;
    label: string;
    metadata?: Record<string, unknown>;
}) {
    const appearance = getMentionAppearance({ id, kind, label, metadata });
    const displayLabel = getMentionDisplayLabel({ id, kind, label, metadata });
    const style = getMentionStyle(appearance);

    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center gap-0.5 whitespace-nowrap align-[-0.06em] font-semibold leading-[inherit]',
                getMentionTextToneClassName(appearance.tone),
                className
            )}
            contentEditable={false}
            style={style}
            title={displayLabel}
        >
            <MentionAppearanceIcon
                className={cn(
                    'size-[1.02em] shrink-0 object-contain opacity-90',
                    getMentionIconToneClassName(appearance.tone)
                )}
                icon={appearance.icon}
                iconDataUrl={appearance.iconDataUrl}
            />
            <span>{displayLabel}</span>
        </span>
    );
}

function getMentionStyle(appearance: { brandColor?: string }) {
    return appearance.brandColor
        ? ({ '--mention-brand-color': appearance.brandColor } as React.CSSProperties)
        : undefined;
}
