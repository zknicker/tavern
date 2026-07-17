import type { IconSvgElement } from '@hugeicons/react';
import {
    Moon02Icon,
    Sun01Icon,
    SunriseIcon,
    SunsetIcon,
} from '@hugeicons-pro/core-duotone-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import {
    getOverviewTimeTone,
    type OverviewGreetingParts,
    type OverviewTimeTone,
} from './overview-heading.ts';

const timeToneIcons: Record<OverviewTimeTone, { className: string; icon: IconSvgElement }> = {
    day: { icon: Sun01Icon, className: 'text-warning' },
    night: { icon: Moon02Icon, className: 'text-info' },
    sunrise: { icon: SunriseIcon, className: 'text-warning' },
    sunset: { icon: SunsetIcon, className: 'text-brand' },
};

export function OverviewHeader({
    greeting,
    heading,
}: {
    greeting: OverviewGreetingParts;
    heading: string;
}) {
    const tone = timeToneIcons[getOverviewTimeTone()];
    const dateLine = new Date()
        .toLocaleDateString('en-US', { day: 'numeric', month: 'long', weekday: 'long' })
        .toUpperCase();

    // The greeting anchors the very top of the page: one quiet monochrome
    // line (the time-tone icon keeps its color), with the date riding the
    // subline row instead of floating above as a distant eyebrow.
    return (
        <header>
            <h1 className="flex flex-wrap items-center gap-x-4 font-display-overview text-8xl text-foreground leading-none">
                <span>
                    {greeting.lead} {greeting.accent}
                    {greeting.name ? `, ${greeting.name}` : ''}
                </span>
                <Icon
                    aria-hidden="true"
                    className={`size-14 self-center ${tone.className}`}
                    icon={tone.icon}
                />
            </h1>
            <div className="mt-3 flex items-center gap-3">
                <p className="min-w-0 max-w-[52ch] text-muted-foreground text-xl">{heading}</p>
                <p className="ml-auto shrink-0 font-medium text-muted-foreground/80 text-xs tracking-[0.18em]">
                    {dateLine}
                </p>
            </div>
        </header>
    );
}
