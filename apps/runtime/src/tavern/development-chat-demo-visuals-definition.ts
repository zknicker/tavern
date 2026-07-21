import { widgetDemoRenderInput } from './development-chat-demo-basic-definitions';

/**
 * Generative-visual turns for the visuals gallery channel: a token-styled
 * chart, a bare native-styled table, a diagram, a tall visual that exercises
 * the collapse affordance, and a malformed body that proves error-tolerant
 * degradation. Bodies follow the visuals skill (theme tokens only,
 * content-first ordering).
 */
export function visualDemoTurns() {
    return [
        {
            reply: 'Drew it as an inline visual.',
            request: 'Draw weekly sales as a bespoke chart visual.',
            slug: 'visual_chart',
            widgets: [
                {
                    fallbackText: 'Weekly sales',
                    title: 'Visual',
                    widget: widgetDemoRenderInput('visual', 'Weekly sales', {
                        html: chartVisualHtml,
                        title: 'Weekly sales',
                    }),
                },
            ],
        },
        {
            reply: 'Rendered as a bare HTML table; the frame styles it natively.',
            request: 'Show regional revenue as a plain table.',
            slug: 'visual_table',
            widgets: [
                {
                    fallbackText: 'Regional revenue',
                    title: 'Visual',
                    widget: widgetDemoRenderInput('visual', 'Regional revenue', {
                        html: tableVisualHtml,
                        title: 'Regional revenue',
                    }),
                },
            ],
        },
        {
            reply: 'Here is the pipeline as a diagram visual.',
            request: 'Diagram the deploy pipeline.',
            slug: 'visual_diagram',
            widgets: [
                {
                    fallbackText: 'Deploy pipeline',
                    title: 'Visual',
                    widget: widgetDemoRenderInput('visual', 'Deploy pipeline', {
                        html: diagramVisualHtml,
                        title: 'Deploy pipeline',
                    }),
                },
            ],
        },
        {
            reply: 'Full quarter timeline below; it collapses until expanded.',
            request: 'Show the release timeline for the whole quarter.',
            slug: 'visual_tall',
            widgets: [
                {
                    fallbackText: 'Q3 release timeline',
                    title: 'Visual',
                    widget: widgetDemoRenderInput('visual', 'Q3 release timeline', {
                        html: tallVisualHtml(),
                        title: 'Q3 release timeline',
                    }),
                },
            ],
        },
        {
            reply: 'This body is deliberately malformed; the sandbox renders what it can.',
            request: 'Render a visual with broken HTML.',
            slug: 'visual_malformed',
            widgets: [
                {
                    fallbackText: 'Broken markup demo',
                    title: 'Visual',
                    widget: widgetDemoRenderInput('visual', 'Broken markup demo', {
                        html: malformedVisualHtml,
                        title: 'Broken markup demo',
                    }),
                },
            ],
        },
    ];
}

const chartVisualHtml = `<h2 style="margin:0 0 4px;font-size:15px;font-weight:600">Weekly sales</h2>
<p style="margin:0 0 12px;color:var(--muted-foreground)">Up 18% over last week, led by Thursday.</p>
<svg viewBox="0 0 640 200" width="100%" role="img" aria-label="Weekly sales bar chart">
  <line x1="0" y1="160" x2="640" y2="160" stroke="var(--chart-grid)" />
  <line x1="0" y1="80" x2="640" y2="80" stroke="var(--chart-grid)" />
  <rect x="30" y="100" width="52" height="60" rx="3" fill="var(--chart-1)" />
  <rect x="120" y="84" width="52" height="76" rx="3" fill="var(--chart-1)" />
  <rect x="210" y="110" width="52" height="50" rx="3" fill="var(--chart-1)" />
  <rect x="300" y="40" width="52" height="120" rx="3" fill="var(--chart-1)" />
  <rect x="390" y="70" width="52" height="90" rx="3" fill="var(--chart-1)" />
  <text x="56" y="180" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">Mon</text>
  <text x="146" y="180" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">Tue</text>
  <text x="236" y="180" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">Wed</text>
  <text x="326" y="180" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">Thu</text>
  <text x="416" y="180" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">Fri</text>
</svg>`;

// Bare <table> markup on purpose: the sandbox base stylesheet owns the look
// (ui/table.tsx parity), so a styled table here would mask a regression.
const tableVisualHtml = `<h2 style="margin:0 0 12px;font-size:15px;font-weight:600">Regional revenue</h2>
<table>
  <thead>
    <tr><th>Region</th><th style="text-align:right">Revenue</th><th style="text-align:right">Change</th></tr>
  </thead>
  <tbody>
    <tr><td>North America</td><td style="text-align:right">$412,900</td><td style="text-align:right">+8.2%</td></tr>
    <tr><td>Europe</td><td style="text-align:right">$268,400</td><td style="text-align:right">+3.1%</td></tr>
    <tr><td>Asia Pacific</td><td style="text-align:right">$194,700</td><td style="text-align:right">-1.4%</td></tr>
  </tbody>
  <tfoot>
    <tr><td>Total</td><td style="text-align:right">$876,000</td><td style="text-align:right">+4.6%</td></tr>
  </tfoot>
  <caption>Q2 revenue by region, year over year.</caption>
</table>`;

const diagramVisualHtml = `<h2 style="margin:0 0 12px;font-size:15px;font-weight:600">Deploy pipeline</h2>
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
  <div style="padding:10px 14px;background:var(--surface-3);border:1px solid var(--border-strong);border-radius:var(--radius-lg)">
    <div style="font-weight:600">Build</div>
    <div style="font-size:12px;color:var(--muted-foreground)">2m 10s</div>
  </div>
  <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><path d="M0 6h22m-5-5 5 5-5 5" fill="none" stroke="var(--border-strong)" stroke-width="1.5"/></svg>
  <div style="padding:10px 14px;background:var(--surface-3);border:1px solid var(--border-strong);border-radius:var(--radius-lg)">
    <div style="font-weight:600">Test</div>
    <div style="font-size:12px;color:var(--success-foreground)">Passing</div>
  </div>
  <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><path d="M0 6h22m-5-5 5 5-5 5" fill="none" stroke="var(--border-strong)" stroke-width="1.5"/></svg>
  <div style="padding:10px 14px;background:var(--brand-muted);border:1px solid var(--brand);border-radius:var(--radius-lg)">
    <div style="font-weight:600;color:var(--brand-muted-foreground)">Release</div>
    <div style="font-size:12px;color:var(--muted-foreground)">Waiting on signing</div>
  </div>
</div>`;

function tallVisualHtml() {
    const weeks = Array.from({ length: 13 }, (_, index) => {
        const label = `Week ${index + 1}`;
        const note = index % 3 === 0 ? 'Milestone review' : 'Feature work and fixes';
        return `<div style="position:relative;padding:0 0 18px 20px;border-left:1px solid var(--border-strong)">
  <span style="position:absolute;left:-4px;top:4px;width:7px;height:7px;border-radius:50%;background:var(--chart-1)"></span>
  <div style="font-weight:600">${label}</div>
  <div style="font-size:12px;color:var(--muted-foreground)">${note}</div>
</div>`;
    }).join('\n');

    return `<h2 style="margin:0 0 12px;font-size:15px;font-weight:600">Q3 release timeline</h2>\n${weeks}`;
}

// Unclosed elements and a truncated attribute: the browser's error-tolerant
// parser must still produce a readable document inside the sandbox.
const malformedVisualHtml = `<h2 style="margin:0 0 8px;font-size:15px;font-weight:600">Broken markup demo
<p style="color:var(--muted-foreground)">This paragraph never closes, and the div below is truncated mid-attribute.
<div style="padding:10px;border:1px solid var(--border-strong);border-radius:var(--radius-lg)"><strong>Still readable</strong> content
<span style="color:`;
