import { Plus } from '@hugeicons/core-free-icons';
import { FluidList, FluidListItem } from '../../components/ui/fluid-list.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { type SuggestedAutomation, suggestedAutomations } from './suggested-automations.ts';

// Suggested-automation rows: shipped templates that prefill the normal
// editor, rendered as a continuation of the jobs list (hairline, mono
// label, job-row anatomy). Each suggestion's colored icon sits in the
// status-dot slot ("potential, not yet running"); a suggestion disappears
// once a job with its name exists.
export function SuggestedAutomationsSection({
    existingNames,
    onAdd,
}: {
    existingNames: Set<string>;
    onAdd: (id: string) => void;
}) {
    const suggestions = suggestedAutomations.filter(
        (suggestion) => !existingNames.has(suggestion.name)
    );

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <section className="mt-6 border-border border-t pt-3">
            <h2 className="font-medium font-mono text-[var(--nav-section-label)] text-xs uppercase tracking-wider">
                Suggested
            </h2>
            <FluidList className="mt-2 grid">
                {suggestions.map((suggestion, index) => (
                    <FluidListItem className="-mx-3" index={index} key={suggestion.id}>
                        <SuggestedAutomationRow onAdd={onAdd} suggestion={suggestion} />
                    </FluidListItem>
                ))}
            </FluidList>
        </section>
    );
}

function SuggestedAutomationRow({
    onAdd,
    suggestion,
}: {
    onAdd: (id: string) => void;
    suggestion: SuggestedAutomation;
}) {
    const cadence = suggestion.template.cronExpr;

    return (
        <div className="group/suggested-row relative flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
            <button
                aria-label={`Add ${suggestion.name}`}
                className="no-drag absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                data-window-drag-disabled=""
                onClick={() => onAdd(suggestion.id)}
                type="button"
            />

            <Icon
                aria-hidden="true"
                className={`pointer-events-none relative z-10 size-4 shrink-0 ${suggestion.iconClassName}`}
                icon={suggestion.icon}
            />

            <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col gap-1 text-left">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-medium text-[15px] text-foreground">
                        {suggestion.name}
                    </span>
                    {cadence ? (
                        <>
                            <span className="hidden text-muted-foreground sm:inline">·</span>
                            <span className="hidden min-w-0 truncate text-muted-foreground sm:inline">
                                {cadence}
                            </span>
                        </>
                    ) : null}
                </div>
                <p className="max-w-[36rem] truncate text-muted-foreground text-xs">
                    {suggestion.description}
                </p>
            </div>

            <div className="relative z-20 ml-auto flex h-8 shrink-0 items-center">
                <Button
                    aria-label={`Add ${suggestion.name}`}
                    onClick={() => onAdd(suggestion.id)}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                >
                    <Icon aria-hidden="true" className="size-4" icon={Plus} />
                </Button>
            </div>
        </div>
    );
}
