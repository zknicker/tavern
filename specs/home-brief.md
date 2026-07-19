# Home Brief

The home page opens with the brief: one flowing block of large text that
reads the workspace like a storybook narrator. A shipped automation
maintains it as an agent-authored HTML page (see Implementation); this
spec is the writing and design guidance that generation must follow. The
visual language was worked out on the dev page `/design/brief`
(Settings > Appearance > Design Lab), which stays as the living reference
for chips, the wordmark, and the pattern examples.

## Implementation

- The home canvas is `workbench/home.html` in the maintaining agent's
  workspace, rendered in the app's sandboxed widget frame with the host
  token and font bridge (`HomeCanvas` in
  `apps/website/src/features/overview/home-canvas.tsx`), above the native
  live surfaces (agent cards, activity feed). Any agent may own the file;
  the app reads every agent's copy and renders the freshest. Generated-time
  content lives in the canvas with "as of" semantics; live state stays
  native.
- Height contract: the page declares
  `<meta name="tavern-canvas-height" content="240">` (clamped 120-720,
  default 200).
- A starter page ships with the app
  (`home-canvas-starter.html`) and renders as the fallback whenever no
  agent has authored the file. It makes no clock claims (a timeless
  greeting, no weekday or daypart), because freshness is the automation's
  job, not the page's: the agent regenerates on cadence with the current
  time, day, and real weather from its own tools. No inline script, no
  app-side brief renderer. A paused automation leaves a visibly dated
  page, which is the honest signal.
- Generation is the first entry in the suggested-automations catalog: an
  ordinary cron job (~20 minute cadence) the operator owns outright after
  enabling. Its prompt carries this spec's voice, chip, day-cycle, and
  occasion rules.
- The catalog is a static list in the app (templates update with app
  releases). Adding a suggestion defaults to the first agent in the agent
  list, with a picker to choose another.
- Creativity contract: the previous render is reference, not template. The
  automation deliberately differs from it (never the same sentence
  structure twice in a row). Content the operator added or asked for is
  sacred; content the automation authored is freely rewritten.
- Agent faces render in-frame via injected sprites: the app serializes the
  live AgentFace roster to data-URI CSS at render time, and the page seats
  a face with `<span class="tavern-face" data-agent="<name>"></span>`
  (name lowercased). Injection-time resolution keeps characters, colors,
  and theme ink current even when the page is stale.

## Voice

- Base voice is quiet connective prose: light italic, muted grey. It exists
  to give the chips air. Data never hides in the base voice.
- The narrator is a gentle storybook narrator, in the register of the
  Winnie-the-Pooh narrator: calm, observational, lightly fond. Not wry, not
  snarky. No editorial asides ("and about time too").
- Economy is the bar of a good author. No padded warmth or cheap flourishes
  ("wrapping up a good little week", "did their thing"). Every word earns
  its place; when in doubt, cut.
- The scenery is where the poetry lives, and the poetry is serene
  simplicity, never ornate metaphor. The Grotto is a calm place, a dimly
  lit resort at the end of a long day: "The lights dim serenely throughout
  the Grotto", "A quiet Friday settles over the Grotto". Plain gentle
  words in a soft rhythm; nothing strained ("silvers the mouth of the
  Grotto" is trying too hard). Data beats stay plain and concrete.
- Keep images literal. A moon rises, lights dim, a day comes to a close;
  a Friday cannot settle over a building. If a pairing sounds surreal, use
  the plain verb.
- Warm, not rented. The brief should feel like coming back to a lamplit
  resort at night: cozy, a little nostalgic, never sterile. Draw that
  warmth from the Grotto's own furniture (the day, the lights, the moon,
  the workshop) in the narrator's gentle cadence: "before the day had
  properly begun". Never from stock props the world does not contain:
  "before the coffee went cold" and "before the ink dried" perform
  coziness instead of observing it.
- No decorative adverbs on facts. Never ascribe a manner the data does not
  show: "quietly tuned", "steadily closed" are filler. (Adverbs are welcome
  in scenery when they earn their place.)
- The brief is a moment in time. It regenerates through the day (as often
  as every 20 minutes), so write the present snapshot: "so far", "just
  now", "this morning". Day-closing arcs only when the day is actually
  closing.
- Tense follows the clock. Morning looks forward, midday reports in
  progress, evening reflects. See The day cycle.
- The Grotto is a place, not a person. Frame it as the setting ("A busy day
  in the Grotto", "Under a crescent moon, another week in the Grotto comes
  to a close"), never as an actor ("The Grotto had itself a day", "opened
  its doors").
- Every metric names its source: "$214 on Amazon", "4 orders on Etsy".
  Never vague containers like "the shops" or "the business". Plural framing
  is allowed only when citing multiple named sources.
- No AI-isms. Never use em dashes. No "delve", no breathless exclamation
  chains. Commas and periods carry the rhythm.
- Numerals for every metric ($214, 24, 3). Spelled-out counts are not used.
- Flow beats completeness: drop facts freely. The brief summarizes; the
  activity feed reports.

## Chips

A chip is bold colored text with a same-color icon, no background, ever.
The full vocabulary accumulates in the chip lab on `/design/brief`.

- Action chips carry their verb: `closed 3 tasks`, `tuned 24 ad bids`,
  `sent 12 replies`, `ran Morning digest`. A bare `3 tasks` is ambiguous
  (done? blocked?), so the verb lives inside the chip.
- Verb choice is natural product language: tasks are "closed", never
  "cleared" or "resolved"-style synonyms reaching for variety.
- Metric chips are the number, not the platform: `$214`, `24 sales`,
  `4 orders`. Platform context follows as plain muted text ("on Amazon");
  the platform also lives in the chip icon.
- Agent chips are the doodle face plus the name, bold, in the face art's
  color. An agent name never appears without its face.
- Color is semantics, not ornament. Marketplace figures wear the
  marketplace's logo and tone ("$214 on Amazon" is amber with the Amazon
  logo, "4 orders on Etsy" is orange with the Etsy mark); the green dollar
  chip is reserved for money aggregated across sources. Agent work leans
  blue; ads are pink; time and automations are purple; weather is blue by
  night, amber by day; holidays are red or their own seasonal tone.
- Holidays and occasions are chips too: "Christmas Eve" with a gift,
  "Halloween" with a pumpkin, a birthday with a cake — whatever the icon
  set offers.
- Budget: at most ~6 chips per brief, with at least 3-4 plain grey words
  between consecutive chips. An agent chip followed by its action chip
  (subject + predicate) is the one allowed adjacency.
- The wordmark counts as a chip for spacing, and chips never touch, even
  across a sentence boundary: put at least a word or two of grey before the
  next chip. "over the Grotto tonight. Otto closed..." reads fine;
  "in the Grotto. Otto closed..." does not.
- Chip spacing is the hard constraint: when the grey words will not fit
  between two chips, drop a fact or split the sentence. Never tighten the
  gap.

## Wordmark

- "Grotto" renders as the inline wordmark (Reel Variable; treatment owned by
  `GrottoMark`), and it lands in the first clause: the sentence happens *in*
  or *over* the Grotto. Never bury it mid-paragraph.
- Rotate the wordmark's role, not just its position. Four slots: over it,
  inside it, waking it up, closing it down. Pick a different slot than the
  previous run.
- Variety is a requirement, not a nicety. The brief should occasionally
  land a small pang of delight; a brief that reads identically run after
  run is a brief nobody reads by week two.

## Live facts

- Sky scenery, the weekday, and the weather come from the generating
  agent's own tools at run time, on the regeneration cadence. Weather is
  real weather, not decoration.

## The day cycle

The clock picks the pattern, and the clock picks the stance. This is not a
style choice: at 9am there are no completed-task counts, so the morning
brief is honest only when it looks forward. Examples on `/design/brief`.

| Phase | Stance | Patterns |
| --- | --- | --- |
| Morning | Aspirational: the day is ahead | The open |
| Midday | In progress: "so far", "just now" | Midday check |
| Afternoon | In progress, a verdict forming | Money first (strong revenue only) |
| Evening | Reflective: the day in past tense | Scene first, Day with a shape, The close |
| Week boundary | Reflective at week scale | The close (week form) |
| Any phase | Density regulators | The quiet one (sparse), Fragments (crowded) |

- The open: scenery plus what is queued: tasks waiting, automations
  scheduled, calendar ahead.
- Midday check: partial numbers, present tense, "sits at ... so far".
- Money first: revenue headline plus named channel detail, agent beats
  follow.
- Scene first: sky over the Grotto, then agent beats, money lands last.
- Day with a shape: the day on a clock: morning, afternoon, moonrise. The
  most reliably generatable shape.
- The close: the scene winds the day or week down ("Under a crescent moon,
  another week in the Grotto comes to a close").
- The quiet one: slow-day floor, mostly prose, a handful of chips.
- Fragments: one short clause per fact when facts pile up.

## Occasions

Occasions sit on top of the day cycle and color the scene. At most one
occasion per brief; stacking reads as a greeting card.

- Week texture: Friday carries the week's end, Monday a fresh start.
  Weekends run slower and softer; not much may be stirring, and that is
  fine to say.
- Holidays: named plainly and woven into the scenery ("It is Christmas Eve
  in the Grotto, and the lights feel warmer for it").
- The small hours: deep in the night the narrator may gently notice the
  hour. Nothing is urgent; say so, and let the reader go back to bed.
- A light day: occasionally (roughly one brief in eight) the register may
  turn gently playful. Whimsy in the Pooh key, never comedy, never at the
  data's expense.
- The fourth wall: the narrator may address the reader directly only when
  the occasion calls for it (the small hours, a weekend send-off, a
  holiday), and only one short sentence.
