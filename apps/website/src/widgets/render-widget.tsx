import { type WidgetRenderInput, widgetRenderInputSchema } from '@tavern/api/widgets';
import {
    KitBarChart,
    KitCalendarDay,
    KitCalendarEvent,
    KitComposedChart,
    KitLineChart,
    KitTable,
} from '../kit/index.ts';
import type { ChatLogOutput } from '../lib/trpc.tsx';
import { cn } from '../lib/utils.ts';
import { WidgetHtmlPreview } from './html-preview.tsx';
import { WidgetMerchBaseSalesChart } from './merchbase-sales-chart.tsx';

type WidgetRow = Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'widget' }>;

export function AgentWidget({ row }: { row: WidgetRow }) {
    const rendered = renderWidget(row);

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

function renderWidget(row: WidgetRow) {
    const widget = row.widget;

    if (widget.validationError || widget.target !== 'chat.inline') {
        return null;
    }

    const parsed = widgetRenderInputSchema.safeParse({
        component: widget.component,
        fallback: { text: widget.fallbackText },
        props: widget.props,
        target: widget.target,
    });

    if (!parsed.success) {
        return null;
    }

    // The sending agent's identity scopes workspace-backed widgets to that
    // agent's confined workspace reads.
    const agentId = row.actor?.kind === 'agent' ? row.actor.id : null;

    return (
        <div className="flex max-w-[46rem] flex-col gap-3">
            {widgetElement(parsed.data, agentId)}
        </div>
    );
}

function widgetElement(input: WidgetRenderInput, agentId: string | null) {
    switch (input.component) {
        case 'tavern.widget.table':
            return <KitTable columns={input.props.columns} rows={input.props.rows} />;
        case 'tavern.widget.bar-chart':
            return <KitBarChart {...input.props} />;
        case 'tavern.widget.line-chart':
            return <KitLineChart {...input.props} />;
        case 'tavern.widget.composed-chart':
            return <KitComposedChart {...input.props} />;
        case 'tavern.widget.calendar-event':
            return <KitCalendarEvent {...input.props} />;
        case 'tavern.widget.calendar-day':
            return <KitCalendarDay {...input.props} />;
        case 'tavern.widget.html-preview':
            return <WidgetHtmlPreview agentId={agentId} props={input.props} />;
        case 'tavern.widget.merchbase-sales-chart':
            return <WidgetMerchBaseSalesChart props={input.props} />;
        default:
            return null;
    }
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
