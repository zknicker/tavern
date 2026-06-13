interface BuildOverviewHeadingInput {
    now?: Date;
    phraseSeed?: number;
}

export const overviewIdleHourPhrases = [
    [
        "Midnight's struck; the hearth keeps you.",
        'The witching hour finds you waking.',
        'Twelve slow bells; embers still glow.',
    ],
    [
        'One bell tolls through the dark.',
        'The night runs deep and quiet.',
        'Only you and the dying fire.',
    ],
    [
        'The small hours guard your secrets.',
        'Two bells; the world sleeps on.',
        'Shadows lengthen across the empty floor.',
    ],
    [
        'Deepest dark; even ghosts sleep.',
        "The fire's low; the road's far.",
        'Three bells toll for the sleepless.',
    ],
    [
        'Dream on; dawn is still distant.',
        'The longest dark thins toward grey.',
        "Rest now; morning isn't ready.",
    ],
    [
        'First grey light, fresh bread baking.',
        'The hearth wakes before the sun.',
        'Dawn stirs; the ovens are warm.',
    ],
    [
        'Dawn bells ring; the road waits.',
        'Sunrise gilds the windowpanes for you.',
        'First light; the day unfolds.',
    ],
    [
        'Early sun; shoulder your pack.',
        "Morning's here; the road calls.",
        'Birdsong and bread greet the traveler.',
    ],
    [
        'Morning light warms the tables.',
        'The sun climbs; tankards are filled.',
        'Eight bells; the hall stirs awake.',
    ],
    [
        "The day's new maps await you.",
        'Mid morning sun spills across parchment.',
        'Quests gather as the day brightens.',
    ],
    [
        'Mid morning quests hang by the door.',
        "The hall hums; the sun's high.",
        'Fresh rumors ride the morning air.',
    ],
    [
        'Lean in before noon; rumors stir.',
        'The sun nears its peak overhead.',
        'Late morning; the crowd thickens.',
    ],
    [
        'Midday stew is ladled hot.',
        'Noon bells; the hall is full.',
        'The sun stands high; eat well.',
    ],
    [
        'Afternoon tales over shared bread.',
        'The day leans past its peak.',
        'Warm light; the meal lingers on.',
    ],
    [
        'A bard tunes in the sun.',
        'Afternoon drowses; the fire murmurs.',
        'The day stretches long and golden.',
    ],
    [
        'Trace your road while light holds.',
        'The sun begins its slow descent.',
        'Afternoon gold pools on the maps.',
    ],
    [
        'Long shadows lean toward evening.',
        'The light turns amber and low.',
        'Late afternoon; the road quiets.',
    ],
    [
        'Dusk gathers; lanterns are kindled.',
        'The sun sinks; the hall warms.',
        'Evening creeps in; candles are lit.',
    ],
    [
        "Evening's first song lifts everyone.",
        'Twilight falls; the hearth roars bright.',
        'Day ends; the music begins.',
    ],
    [
        'Night falls; raise your tankard.',
        'Lamplight glows; the hall fills.',
        'Evening deepens; the songs grow louder.',
    ],
    [
        'Late now; mind the stranger.',
        'Full dark outside; warmth within.',
        'The night quickens; secrets stir.',
    ],
    [
        'Deep evening, whispers, coins, secrets.',
        'The hour grows old and strange.',
        'Lanterns flicker; the crowd leans close.',
    ],
    [
        'The fire sinks; rest soon.',
        'Late bells; the hall thins out.',
        'Night settles heavy on the rafters.',
    ],
    [
        'Near midnight; last call sounds.',
        "The day's nearly spent; linger here.",
        'Eleven bells; the embers fade.',
    ],
] as const;

export function buildOverviewHeading({
    now = new Date(),
    phraseSeed = Math.random(),
}: BuildOverviewHeadingInput = {}) {
    return getIdleTimePhrase(now, phraseSeed);
}

function getIdleTimePhrase(now: Date, phraseSeed: number) {
    const hour = now.getHours();
    const phrases = overviewIdleHourPhrases[hour] ?? overviewIdleHourPhrases[0];
    return phrases[getPhraseIndex(phraseSeed, phrases.length)] ?? phrases[0];
}

function getPhraseIndex(phraseSeed: number, phraseCount: number) {
    return Math.floor(Math.abs(phraseSeed % 1) * phraseCount);
}
