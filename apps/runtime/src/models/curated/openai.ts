import type { CuratedModel } from '../provider-sources/shared.ts';

export const curatedOpenAiModels = [
    { label: 'GPT-5.5', modelId: 'gpt-5.5' },
    { label: 'GPT-5.5 Pro', modelId: 'gpt-5.5-pro' },
    { label: 'GPT-5.4', modelId: 'gpt-5.4' },
    { label: 'GPT-5.4 Mini', modelId: 'gpt-5.4-mini' },
    { label: 'GPT-4.1', modelId: 'gpt-4.1' },
    { label: 'GPT-4.1 Mini', modelId: 'gpt-4.1-mini' },
    { label: 'GPT-4o', modelId: 'gpt-4o' },
    { label: 'GPT-4o Mini', modelId: 'gpt-4o-mini' },
] as const satisfies CuratedModel[];
