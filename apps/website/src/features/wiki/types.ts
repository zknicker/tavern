import type { WikiListOutput, WikiPageOutput, WikiStatusOutput } from '../../lib/trpc.tsx';

export type WikiPageNode = WikiListOutput['pages'][number];
export type WikiPageDetail = NonNullable<WikiPageOutput>;
export type WikiStatus = NonNullable<WikiStatusOutput>;
