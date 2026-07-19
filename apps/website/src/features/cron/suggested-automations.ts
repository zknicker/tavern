import type { IconSvgElement } from '@hugeicons/react';
import { Home09Icon } from '@hugeicons-pro/core-solid-rounded';
import type { CronFormState } from './cron-form.ts';
import { homeBriefAutomationMessage } from './home-brief-template.ts';

// Suggested automations (specs/home-brief.md): a static catalog of templates
// shipped with the app. Adding one just prefills the normal automation
// editor — the created cron job is entirely operator-owned afterward. Each
// suggestion carries a colored icon for its list row.
export interface SuggestedAutomation {
    description: string;
    icon: IconSvgElement;
    iconClassName: string;
    id: string;
    name: string;
    template: Partial<CronFormState>;
}

export const suggestedAutomations: SuggestedAutomation[] = [
    {
        description: 'Keeps the home page fresh with a short narrated brief of your workspace.',
        icon: Home09Icon,
        iconClassName: 'text-brand-muted-foreground',
        id: 'home-brief',
        name: 'Home brief',
        template: {
            cronExpr: '*/20 * * * *',
            description: 'Refreshes the Grotto home page with a narrated brief.',
            message: homeBriefAutomationMessage,
            name: 'Home brief',
            runType: 'agentTurn',
            scheduleKind: 'custom',
        },
    },
];

export function getSuggestedAutomation(id: string): SuggestedAutomation | null {
    return suggestedAutomations.find((suggestion) => suggestion.id === id) ?? null;
}
