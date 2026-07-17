/**
 * Agent-facing Widget guidance. This is the only always-on prompt surface for
 * Widgets; keep every line decision-oriented and signatures compact.
 *
 * Each widget contributes one entry to `widgetPromptEntries`. The `satisfies`
 * check makes a missing entry a compile error, so a widget can never be added
 * to the schema without also teaching the agent to author it. Plugin-owned
 * entries live beside their schema (see the merchbase entry) and are gated into
 * the prompt by the caller, not here.
 */

import { type WidgetName, widgetFenceLabel } from './contracts.ts';
import { widgetMerchBaseSalesChartPromptEntry } from './merchbase/contracts.ts';

export interface WidgetPromptEntry {
    /** Optional extra constraints or shorthands the signature can't convey. */
    constraints?: string;
    /** One-line purpose, decision-oriented (when to reach for this widget). */
    description: string;
    /** Compact props signature, or a pointer to another widget's signature. */
    signature: string;
}

const widgetRules = `Render an app-native widget by writing a fenced code block whose language is \`widget:<name>\`, containing exactly one JSON object of props:

\`\`\`widget:bar-chart
{"title":"Weekly sales","xKey":"day","series":[{"key":"sold","label":"Sold"}],"data":[{"day":"Mon","sold":4},{"day":"Tue","sold":7}]}
\`\`\`

Tavern strips the fence from your visible reply and renders the widget in place.

Rules:
- Use a widget by default when an answer is primarily tabular, chartable, or calendar-shaped. Use concise text when a widget would be forced, too small to matter, or too large to scan.
- The fence body must be one complete valid JSON object with no comments or trailing commas. If unsure the props are valid, reply with text instead.
- Use widget:table instead of Markdown tables.
- Build an artifact for anything the user will keep or iterate on: write one self-contained .html file (inline CSS/JS, no external assets) under workbench/, then reference it with a bare \`artifact\` fence. The chat shows a compact card that opens the page in the artifact pane.
- Widget fence bodies are pure JSON — never HTML, JSX, CSS, class names, or imports. Raw HTML belongs only in a \`visual\` fence.
- Do not repeat identical content in prose and in a widget; prose around the fence should add context, not restate it.
- Multiple widget fences in one reply are allowed when the answer has clearly separate visual parts; prefer one.`;

const widgetPromptEntries = {
    table: {
        description: 'Compact rows and columns for tabular data.',
        signature:
            '{"columns":[{"key":string,"label":string,"align"?:"left"|"right"}],"rows":[{<key>:string|number|boolean|null}]}',
        constraints:
            'Shorthand: "columns" as plain label strings with "rows" as cell arrays in column order. Max 8 columns, 50 rows.',
    },
    'bar-chart': {
        description: 'Bar chart for nonnegative comparable numeric series (rankings, totals).',
        signature:
            '{"title":string,"xKey":string,"series":[{"key":string,"label":string}],"data":[{...}],"unit"?:string}',
        constraints:
            'Each data row holds the xKey value plus one number per series key. Max 4 series, 50 rows.',
    },
    'line-chart': {
        description: 'Line chart for trend series; values may be negative.',
        signature: 'Same props as widget:bar-chart.',
    },
    'composed-chart': {
        description: 'Combined bars and lines for related quantities sharing one x-axis.',
        signature:
            '{"title":string,"xKey":string,"barSeries":[{"key":string,"label":string}],"lineSeries":[{"key":string,"label":string}],"data":[{...}],"barUnit"?:string,"lineUnit"?:string}',
        constraints: 'Bar values must be nonnegative; bar and line series keys must not overlap.',
    },
    'calendar-event': {
        description: 'Single event card.',
        signature:
            '{"title":string,"date":"YYYY-MM-DD","startTime"?:"HH:mm","endTime"?:"HH:mm","allDay"?:boolean,"location"?:string,"notes"?:string,"calendar"?:string,"timezone"?:string}',
        constraints: 'Timed events need both startTime and endTime; all-day events need neither.',
    },
    'calendar-day': {
        description: 'Single-day agenda with zero or more events.',
        signature:
            '{"date":"YYYY-MM-DD","events":[<calendar-event props without date>],"title"?:string,"timezone"?:string}',
        constraints: 'Max 12 events.',
    },
    'html-preview': {
        description:
            'Sandboxed inline preview of a workspace HTML file; for custom visuals no other widget covers.',
        signature: '{"path":string,"height"?:number,"title"?:string}',
        constraints:
            'Self-contained inline CSS/JS only; load the page-design skill before authoring. Write the file under workbench/ first; path is workspace-relative.',
    },
    artifact: {
        description:
            'Durable self-contained single-file HTML page rendered in the artifact pane; the chat shows a compact card.',
        signature: '{"path":string,"title"?:string}',
        constraints:
            'Self-contained inline CSS/JS only; load the page-design skill before authoring. Write the file under workbench/ first; path is workspace-relative.',
    },
    'merchbase-sales-chart': widgetMerchBaseSalesChartPromptEntry,
} satisfies Record<CatalogWidgetName, WidgetPromptEntry>;

// The `visual` fence is taught in its own prompt section (raw HTML body, not
// a widget:<name> JSON fence), so it never renders a catalog entry here.
type CatalogWidgetName = Exclude<WidgetName, 'visual'>;

function isCatalogWidgetName(name: WidgetName): name is CatalogWidgetName {
    return name !== 'visual';
}

/**
 * Assemble the Widgets prompt for the widgets available to this agent. Pass the
 * gated set (core widgets plus granted-plugin widgets); order is preserved.
 */
export function renderWidgetsPrompt(names: readonly WidgetName[]): string {
    const entries = names
        .filter(isCatalogWidgetName)
        .map((name) => renderWidgetEntry(name, widgetPromptEntries[name]));

    if (entries.length === 0) {
        return widgetRules;
    }

    return `${widgetRules}\n\nAvailable widgets:\n\n${entries.join('\n\n')}`;
}

function renderWidgetEntry(name: CatalogWidgetName, entry: WidgetPromptEntry): string {
    const head = `${widgetFenceLabel(name)} — ${entry.description}\n${entry.signature}`;
    return entry.constraints ? `${head}\n${entry.constraints}` : head;
}
