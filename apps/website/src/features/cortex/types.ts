import type { CortexListOutput, CortexPageOutput, CortexStatusOutput } from '../../lib/trpc.tsx';

export type CortexPageNode = CortexListOutput['pages'][number];
export type CortexPageDetail = NonNullable<CortexPageOutput>;
export type CortexStatus = NonNullable<CortexStatusOutput>;
