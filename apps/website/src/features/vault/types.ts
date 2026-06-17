import type { VaultListOutput, VaultPageOutput, VaultStatusOutput } from '../../lib/trpc.tsx';

export type VaultPageNode = VaultListOutput['pages'][number];
export type VaultPageDetail = NonNullable<VaultPageOutput>;
export type VaultStatus = NonNullable<VaultStatusOutput>;
