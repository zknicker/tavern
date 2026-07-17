interface BuildOverviewHeadingInput {
    now?: Date;
    phraseSeed?: number;
}

export const overviewIdleHourPhrases = [
    [
        'Midnight, and the ideas are still coming.',
        'Up late? Your agents are too.',
        'The quietest hour gets the best work.',
    ],
    [
        'One in the morning, zero judgment.',
        'The night is young and so productive.',
        'Still up? We kept things warm.',
    ],
    [
        'Two a.m. thoughts are secretly brilliant.',
        "Everyone's asleep except your best ideas.",
        "The world is quiet. You're not.",
    ],
    [
        'Three a.m.? Respect, honestly.',
        'Even the moon is winding down.',
        'Deep night, deep focus, no distractions.',
    ],
    [
        'Four a.m. is serious commitment.',
        'The darkest hour before coffee.',
        'Almost dawn. You absolute machine.',
    ],
    [
        'Five a.m. club, meeting in session.',
        "You're up before the birds. Impressive.",
        'Early bird? The agents noticed.',
    ],
    [
        'Good morning, early riser. Coffee first.',
        'The day is fresh, and so are you.',
        'Six a.m. Already winning.',
    ],
    [
        "Good morning. Let's ease into it.",
        "Seven o'clock and full of promise.",
        'Morning! Your agents are warmed up.',
    ],
    [
        'Good morning. Ready when you are.',
        'Eight a.m. looks good on you.',
        'Rise, shine, and ship something.',
    ],
    [
        "Good morning. What's the plan today?",
        "Peak morning energy detected. Let's go.",
        "Nine o'clock and raring to go.",
    ],
    [
        'Ten a.m. and fully in motion.',
        'The morning is yours. Spend it well.',
        'Good morning, right on schedule.',
    ],
    [
        'Eleven and picking up steam.',
        'Almost lunchtime. Stay strong out there.',
        'Late morning, full momentum.',
    ],
    [
        "High noon. How's your day treating you?",
        'Midday already? Time flies with friends.',
        "Lunch o'clock. You've earned it.",
    ],
    [
        'Good afternoon. Back at it?',
        'One p.m. and the day is young.',
        'Afternoon! The agents kept things moving.',
    ],
    [
        'Two p.m. is perfect focus weather.',
        'The afternoon is wide open.',
        'After lunch comes the good stuff.',
    ],
    [
        "Three o'clock slump? Not on our watch.",
        'Mid afternoon and still golden.',
        'Snack break? Fully endorsed around here.',
    ],
    [
        'Four p.m., home stretch incoming.',
        'The afternoon light says keep going.',
        'Still going strong at four.',
    ],
    [
        "Five o'clock somewhere, focused right here.",
        'Good evening soon. Finish strong.',
        "The workday winds down, you don't.",
    ],
    [
        'Good evening. Time to slow down?',
        'Six p.m., golden hour for ideas.',
        'Evening! The agents had a day.',
    ],
    [
        'Seven and the lights stay cozy.',
        "Good evening. What's left on your plate?",
        "Dinner first? We'll hold the fort.",
    ],
    [
        'Eight p.m. Cozy mode activated.',
        'The evening is yours entirely.',
        'Winding down or winding up?',
    ],
    [
        'Nine p.m. Easy does it now.',
        'Good evening. Low stakes, high comfort.',
        'The night begins gently around here.',
    ],
    [
        'Ten p.m.? Gentle productivity only.',
        'Late evening, warm lights, good company.',
        'The agents are getting sleepy. Maybe.',
    ],
    [
        'Eleven. Tomorrow is already jealous.',
        "Last call for today's brilliant ideas.",
        'Almost midnight. Make it count gently.',
    ],
] as const;

export function buildOverviewHeading({
    now = new Date(),
    phraseSeed = Math.random(),
}: BuildOverviewHeadingInput = {}) {
    return getIdleTimePhrase(now, phraseSeed);
}

interface BuildOverviewGreetingInput {
    name?: string | null;
    now?: Date;
}

export interface OverviewGreetingParts {
    accent: string;
    lead: string;
    name: string | null;
}

// Small time-aware greeting line rendered above the heading, split so the UI
// can color the accent word (morning/afternoon/evening/late) to match the
// time-of-day icon. Uses the first name only, so "Zach Knickerbocker" greets
// as "Good morning, Zach".
export function buildOverviewGreeting({
    name,
    now = new Date(),
}: BuildOverviewGreetingInput = {}): OverviewGreetingParts {
    const hour = now.getHours();
    const [lead, accent]: [string, string] =
        hour >= 5 && hour < 12
            ? ['Good', 'morning']
            : hour >= 12 && hour < 18
              ? ['Good', 'afternoon']
              : hour >= 18 && hour < 22
                ? ['Good', 'evening']
                : ['Up', 'late'];
    const firstName = name?.trim().split(/\s+/u)[0];

    return { lead, accent, name: firstName || null };
}

export type OverviewTimeTone = 'day' | 'night' | 'sunrise' | 'sunset';

// Buckets the day into four visual moods. Drives the overview's icon, sky
// tint, and any other time-of-day dressing so they always agree.
export function getOverviewTimeTone(now: Date = new Date()): OverviewTimeTone {
    const hour = now.getHours();

    if (hour >= 5 && hour < 9) {
        return 'sunrise';
    }

    if (hour >= 9 && hour < 17) {
        return 'day';
    }

    if (hour >= 17 && hour < 20) {
        return 'sunset';
    }

    return 'night';
}

function getIdleTimePhrase(now: Date, phraseSeed: number) {
    const hour = now.getHours();
    const phrases = overviewIdleHourPhrases[hour] ?? overviewIdleHourPhrases[0];
    return phrases[getPhraseIndex(phraseSeed, phrases.length)] ?? phrases[0];
}

function getPhraseIndex(phraseSeed: number, phraseCount: number) {
    return Math.floor(Math.abs(phraseSeed % 1) * phraseCount);
}
