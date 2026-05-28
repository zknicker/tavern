import type { AgentRuntimeJobSlug } from '@tavern/api';
import type { RuntimeJobTrigger } from './types';

type RuntimeJobRequestHandler = (
    slug: AgentRuntimeJobSlug,
    options: { trigger: RuntimeJobTrigger }
) => void;

let activeRequestHandler: RuntimeJobRequestHandler | null = null;

export function setRuntimeJobRequestHandler(handler: RuntimeJobRequestHandler | null): void {
    activeRequestHandler = handler;
}

export function requestRuntimeJobRun(
    slug: AgentRuntimeJobSlug,
    options: { trigger: RuntimeJobTrigger }
): void {
    activeRequestHandler?.(slug, options);
}
