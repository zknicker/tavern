import type { ReactNode } from 'react';
import { Label } from '../../../components/ui/primitives/label.tsx';
import { Switch } from '../../../components/ui/switch.tsx';

export function CronSectionHeader({ children, title }: { children?: ReactNode; title: string }) {
    return (
        <div className="flex items-center justify-between">
            <Label className="font-medium text-muted-foreground text-sm">{title}</Label>
            {children}
        </div>
    );
}

export function CronToggleRow({
    checked,
    label,
    onCheckedChange,
}: {
    checked: boolean;
    label: string;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <Label className="cursor-pointer justify-between gap-3 text-sm">
            {label}
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </Label>
    );
}
