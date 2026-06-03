import type { AgentRuntimeHighlight } from '@tavern/api';

export type HighlightCandidate = Omit<AgentRuntimeHighlight, 'expiresAt' | 'generatedAt'>;
