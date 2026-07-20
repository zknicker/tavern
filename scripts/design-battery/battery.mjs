// The fixed design battery (PRD-86): ten prompts that exercise the visuals
// skill across chart, diagram, interactive, and page output. Slugs name the
// screenshot files; kind steers how the runner captures the result.
//
// Prompts are deliberately loose and data-free — phrased the way a user
// actually asks, with the model inventing the numbers. The goal is a broad
// read on unaided capability, not reproducing a reference output; the skill
// text, not the prompt, carries every design decision. A model may route a
// plain chart ask to a catalog widget — that is correct product behavior,
// and the runner captures whatever rendered.

export const designBattery = [
    {
        kind: 'visual',
        prompt: 'Show me a bar chart comparing quarterly revenue across a few regions for a made-up company.',
        slug: 'bar-chart',
    },
    {
        kind: 'visual',
        prompt: 'Chart how daily active users trended over the last month for an imaginary app.',
        slug: 'line-chart',
    },
    {
        kind: 'visual',
        prompt: 'Show monthly orders and conversion rate together for a fictional store — whatever mix of bars and lines reads best.',
        slug: 'composed-chart',
    },
    {
        kind: 'visual',
        prompt: 'Give me a compact row of KPIs with little trend sparklines for a make-believe SaaS.',
        slug: 'sparkline-row',
    },
    {
        kind: 'visual',
        prompt: 'Show me this month versus last month at a glance for a fictional shop — the big numbers and how they moved.',
        slug: 'stat-tiles',
    },
    {
        kind: 'visual',
        prompt: 'Draw a deploy pipeline as a flowchart — make one up, and have one stage failing.',
        slug: 'flowchart',
    },
    {
        kind: 'visual',
        prompt: 'Make me a little interactive savings calculator I can play with.',
        slug: 'interactive-calculator',
    },
    {
        kind: 'visual',
        prompt: 'Can you show me an example display of performance data for a make believe ad campaign? With some charts and stats and stuff.',
        slug: 'dashboard-visual',
    },
    {
        kind: 'artifact',
        prompt: 'Put together a monthly business report page for a made-up company — something I could keep and share.',
        slug: 'artifact-dashboard',
    },
    {
        kind: 'artifact',
        prompt: 'Write up a one-page decision memo for a made-up engineering decision, as a page I can keep.',
        slug: 'artifact-document',
    },
];
