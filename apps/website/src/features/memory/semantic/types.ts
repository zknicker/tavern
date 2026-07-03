import type {
    SemanticMemoryListOutput,
    SemanticMemoryPageOutput,
    SemanticMemoryStatusOutput,
} from '../../../lib/trpc.tsx';

export type SemanticMemoryPageNode = SemanticMemoryListOutput['pages'][number];
export type SemanticMemoryPageDetail = NonNullable<SemanticMemoryPageOutput>;
export type SemanticMemoryStatus = NonNullable<SemanticMemoryStatusOutput>;
