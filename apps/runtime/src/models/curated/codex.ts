import type { CuratedModel } from '../provider-sources/shared.ts';

export const curatedCodexModels = [
    { label: 'GPT-5.5', modelId: 'gpt-5.5' },
    { label: 'GPT-5.4', modelId: 'gpt-5.4' },
    { label: 'GPT-5.4 Mini', modelId: 'gpt-5.4-mini' },
    { label: 'GPT-5.3 Codex', modelId: 'gpt-5.3-codex' },
    { label: 'GPT-5.3 Codex Spark', modelId: 'gpt-5.3-codex-spark' },
] as const satisfies CuratedModel[];
