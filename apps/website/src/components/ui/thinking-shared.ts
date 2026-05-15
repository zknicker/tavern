export const thinkingLevels = [
    'off',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'adaptive',
    'max',
] as const;

export type ThinkingLevelValue = (typeof thinkingLevels)[number];

export interface ThinkingOption {
    description: string;
    label: string;
    value: ThinkingLevelValue;
}

export const thinkingOptions: ThinkingOption[] = [
    {
        description: 'No extra reasoning.',
        label: 'Off',
        value: 'off',
    },
    {
        description: 'Fastest pass with a light check.',
        label: 'Minimal',
        value: 'minimal',
    },
    {
        description: 'Short reasoning for routine work.',
        label: 'Low',
        value: 'low',
    },
    {
        description: 'Balanced depth for most tasks.',
        label: 'Medium',
        value: 'medium',
    },
    {
        description: 'Deeper reasoning for harder tasks.',
        label: 'High',
        value: 'high',
    },
    {
        description: 'Extra-high reasoning for supported models.',
        label: 'XHigh',
        value: 'xhigh',
    },
    {
        description: 'Lets the runtime choose automatically.',
        label: 'Adaptive',
        value: 'adaptive',
    },
    {
        description: 'Provider maximum reasoning.',
        label: 'Max',
        value: 'max',
    },
];

const thinkingOptionsByValue = new Map(
    thinkingOptions.map((option) => [option.value, option] as const)
);

export function getThinkingOption(value: ThinkingLevelValue | null) {
    return value ? (thinkingOptionsByValue.get(value) ?? null) : null;
}

export function isThinkingLevelValue(value: string): value is ThinkingLevelValue {
    return thinkingLevels.includes(value as ThinkingLevelValue);
}
