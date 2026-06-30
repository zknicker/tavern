import type { CuratedModel } from '../provider-sources/shared.ts';

export const curatedClaudeModels = [
    { label: 'Claude Opus 4.8', modelId: 'claude-opus-4-8' },
    { label: 'Claude Opus 4.8 (1M)', modelId: 'opus[1m]' },
    { label: 'Claude Opus 4.7', modelId: 'claude-opus-4-7' },
    { label: 'Claude Opus 4.6', modelId: 'claude-opus-4-6' },
    { label: 'Claude Sonnet 4.6', modelId: 'claude-sonnet-4-6' },
    { label: 'Claude Haiku 4.5', modelId: 'claude-haiku-4-5' },
] as const satisfies CuratedModel[];
