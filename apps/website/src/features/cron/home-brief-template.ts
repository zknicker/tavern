// The Home brief suggested automation's turn prompt. This is the writing
// contract from specs/home-brief.md condensed for the generating agent; it
// ships as an editable message on an ordinary cron job, so operators can
// evolve it freely.
export const homeBriefAutomationMessage = `Refresh the Grotto home page: write workbench/home.html in your workspace.

THE FILE
- One self-contained HTML file. No external scripts, stylesheets, images, or fonts.
- The app injects the design tokens and the 'Reel Variable' display font into the page. Use var(--...) tokens for every color and font; never hardcode values. Keep the page background transparent.
- Include <meta name="tavern-canvas-height" content="240"> sized to your content (120-720).
- If the file already exists, read it first. Anything the operator added or asked for is sacred; keep it working. Everything you authored is yours to rewrite.

THE BRIEF
The page opens with the brief: one flowing block of large text (about 30px, max ~52ch) that reads the workspace right now. Voice:
- Gentle storybook narrator (Winnie-the-Pooh register): calm, observational, lightly fond. No wry asides, no snark, no em dashes, no exclamation chains.
- Base voice is light italic muted grey prose (var(--muted-foreground), weight 300, italic). It exists to give the chips air.
- The scenery is where the poetry lives, and the poetry is serene simplicity, never ornate metaphor. The Grotto is a calm place, like a dimly lit resort at the end of a long day. Keep images literal: a moon rises, lights dim; a Friday cannot settle over a building.
- Warm, never sterile, never rented: draw warmth from the Grotto's own furniture (the day, the lights, the workshop), not stock props like "before the coffee went cold".
- No decorative adverbs on facts. Numerals for every metric. Name every source ("$214 on Amazon", never "the shops"). Drop facts freely; flow beats completeness.

CHIPS
Data renders as chips: bold colored words with a small same-color inline SVG glyph, upright (not italic), no backgrounds or borders ever.
- Action chips carry their verb: "closed 3 tasks", "tuned 24 ad bids". Tasks are "closed".
- Marketplace figures wear the marketplace tone: Amazon amber (var(--label-amber-fg)), Etsy orange (var(--label-orange-fg)). Green (var(--success-foreground)) only for money aggregated across sources. Agent work blue (var(--info-foreground)), ads pink (var(--label-pink-fg)), time and automations purple (var(--brand-muted-foreground)), holidays red (var(--label-red-fg)), weather blue by night and amber by day.
- Agent names are bold in that agent's color. Weekdays and holidays can be chips too.
- At most ~6 chips, a word or two of grey minimum between chips (agent + its action chip is the one allowed adjacency).

THE WORDMARK
"Grotto" appears once, in the first clause, as the wordmark: font-family 'Reel Variable'; font-variation-settings 'HGHT' 46, 'wght' 600; font-size 1.5em; letter-spacing 0.035em; margin-right -0.08em; not italic; color var(--brand) (on dark, mix 52% toward white).

THE CLOCK
Check the current time, day, and real weather with your tools before writing. Tense follows the clock: morning looks forward (what is queued), midday reports in progress ("so far", "just now"), evening reflects. Occasions color the scene, at most one per brief: weekends run slower, holidays are named plainly, deep night may gently notice the reader ("Nothing needs you until morning"), and roughly one brief in eight may turn gently playful.

FACTS
Pull real workspace facts: tasks closed today, automations that ran, replies sent, and business numbers from your skills where available. Below the brief you may keep or add compact blocks (a small chart, a list) the operator wants, styled with the same tokens, flat, no shadows.

VARIETY
Use the previous page as reference, then deliberately differ: never the same sentence structure twice in a row. The brief should occasionally land a small pang of delight.

Write the file, then reply with one short line noting the page was refreshed. Do not paste the HTML into chat.`;
