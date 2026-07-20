// The fixed design battery (PRD-86): ten prompts that exercise the visuals
// skill across chart, diagram, interactive, and page output. Slugs name the
// screenshot files; kind steers how the runner captures the result.
//
// Keep prompts phrased as a user would ask, with data embedded, so the skill
// text — not the prompt — carries the design decisions. "As a custom visual"
// pins the fence type where the catalog would otherwise shortcut the test.

export const designBattery = [
    {
        kind: 'visual',
        prompt: 'Draw a custom visual (not a catalog widget): a bar chart of quarterly revenue by region. North: Q1 42k, Q2 48k, Q3 51k, Q4 61k. South: Q1 31k, Q2 33k, Q3 38k, Q4 44k.',
        slug: 'bar-chart',
    },
    {
        kind: 'visual',
        prompt: 'Draw a custom visual (not a catalog widget): a line chart of daily active users over the last two weeks: 812, 794, 851, 890, 868, 923, 1004, 981, 1010, 1102, 1087, 1140, 1198, 1241. Include a takeaway.',
        slug: 'line-chart',
    },
    {
        kind: 'visual',
        prompt: 'Draw a custom visual (not a catalog widget) combining bars and a line: monthly orders as bars (Jan 340, Feb 388, Mar 356, Apr 410, May 468, Jun 502) with conversion rate as a line (2.1%, 2.4%, 2.2%, 2.6%, 2.9%, 3.1%).',
        slug: 'composed-chart',
    },
    {
        kind: 'visual',
        prompt: 'Draw a custom visual: a compact KPI row with sparklines for four metrics — Revenue $102,676 (trend 82, 85, 91, 88, 96, 103), Orders 3,912 (trend 3.1k, 3.3k, 3.2k, 3.6k, 3.8k, 3.9k), CTR 2.9% (trend 2.4, 2.6, 2.5, 2.7, 2.8, 2.9), Refund rate 1.1% (trend 1.4, 1.3, 1.35, 1.2, 1.15, 1.1).',
        slug: 'sparkline-row',
    },
    {
        kind: 'visual',
        prompt: 'Draw a custom visual: stat tiles summarizing this month vs last — Impressions 2.48M (up 18.2%), Clicks 71,060 (up 9.4%), Conversions 3,912 (up 12.8%), ROAS 4.2x (down 3.1%).',
        slug: 'stat-tiles',
    },
    {
        kind: 'visual',
        prompt: 'Draw a custom visual: a flowchart of our deploy pipeline. Build (2m 10s, passed) → Unit tests (4m 02s, passed) → Integration tests (11m 40s, failed — flaky fixture) → Canary (skipped) → Production (skipped). Show where it stopped and why.',
        slug: 'flowchart',
    },
    {
        kind: 'visual',
        prompt: 'Draw a custom interactive visual: a savings calculator with sliders for monthly contribution ($100–$2,000, start $500) and years (1–30, start 10), assuming 5% annual growth, showing the projected balance update live as I move the sliders.',
        slug: 'interactive-calculator',
    },
    {
        kind: 'visual',
        prompt: "Draw a custom visual: a campaign dashboard for 'Summer glow' (June 1–30). Stat row: Impressions 2.48M (+18.2%), Clicks 71,060 (+9.4%), Conversions 3,912 (+12.8%), ROAS 4.2x (−3.1%). Daily clicks line (14 values): 1.9k, 2.1k, 2.4k, 2.2k, 2.0k, 2.3k, 2.6k, 3.1k, 2.8k, 2.5k, 2.4k, 2.6k, 2.5k, 2.4k. Spend by channel bars: Meta $10,420 (ROAS 4.6x), Google $7,180 (4.1x), TikTok $4,930 (3.8x), Email $2,120 (3.1x). Conversion funnel: Impressions 2.48M → Clicks 71,060 (2.9%) → Add to cart 9,810 (13.8%) → Purchases 3,912 (39.9%).",
        slug: 'dashboard-visual',
    },
    {
        kind: 'artifact',
        prompt: "Build an artifact page: a June business report for 'Lumina skincare'. Sections: summary (revenue $102,676 up 12% MoM, 3,912 orders, AOV $26.25), a monthly revenue trend chart (Jan 78k, Feb 81k, Mar 85k, Apr 88k, May 91.5k, Jun 102.7k), top products table (Glow serum $31,240 / 1,102 units, Night cream $24,880 / 815 units, SPF mist $18,410 / 903 units, Eye balm $12,020 / 511 units), and three risks with severity.",
        slug: 'artifact-dashboard',
    },
    {
        kind: 'artifact',
        prompt: 'Build an artifact page: a one-page decision memo titled "Move image processing to background jobs". Context: uploads block the request thread for 3–8s. Options: (1) inline optimization, low effort, capped upside; (2) queue + worker pool, medium effort, recommended; (3) external service, high cost. Decision: option 2. Include a rollout plan with three phases and a risks section.',
        slug: 'artifact-document',
    },
];
