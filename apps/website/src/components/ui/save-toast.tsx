import {
    AlertCircleIcon,
    CheckmarkCircle02Icon,
    InformationCircleIcon,
} from '@hugeicons/core-free-icons';
import type { HugeiconsIconProps } from '@hugeicons/react';
import { Alert, AlertDescription, type AlertVariant } from './alert.tsx';
import { Icon } from './icon.tsx';

interface SaveToastProps {
    message: string;
    variant: AlertVariant;
}

const toastIcons: Record<AlertVariant, HugeiconsIconProps['icon']> = {
    default: InformationCircleIcon,
    error: AlertCircleIcon,
    info: InformationCircleIcon,
    success: CheckmarkCircle02Icon,
    warning: AlertCircleIcon,
};

export function SaveToast({ message, variant }: SaveToastProps) {
    return (
        <div className="pointer-events-none fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))]">
            <Alert variant={variant}>
                <Icon icon={toastIcons[variant]} />
                <AlertDescription>{message}</AlertDescription>
            </Alert>
        </div>
    );
}
