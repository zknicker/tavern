import type { ChatLogOutput } from '../lib/trpc.tsx';
import { cn } from '../lib/utils.ts';
import { renderCalendarWidget } from './calendar.tsx';
import { renderChartWidget } from './charts.tsx';

type WidgetRow = Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'widget' }>;

export function AgentWidget({ row }: { row: WidgetRow }) {
    const rendered = renderWidget(row.widget);

    if (!rendered) {
        return (
            <WidgetFallback
                error={row.widget.validationError ?? 'Widget unavailable.'}
                text={row.widget.fallbackText}
            />
        );
    }

    return rendered;
}

function renderWidget(widget: WidgetRow['widget']) {
    if (widget.validationError || widget.target !== 'chat.inline' || !widget.component) {
        return null;
    }

    return renderChartWidget(widget) ?? renderCalendarWidget(widget);
}

function WidgetFallback({ error, text }: { error: string | null; text: string }) {
    return (
        <div
            className={cn(
                'max-w-[42rem] rounded-md border border-border bg-surface-2/70 px-3 py-2.5',
                'text-sm leading-5'
            )}
            role="note"
        >
            <p className="whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">
                {text}
            </p>
            {error ? (
                <p className="mt-1 text-muted-foreground text-xs">Widget unavailable.</p>
            ) : null}
        </div>
    );
}
