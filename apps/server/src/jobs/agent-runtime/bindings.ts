import {
    jobDefinitions,
    type RegisteredJobDefinition,
    type RegisteredJobSlug,
} from '../../../../../jobs/index.ts';
import { getQueueBindings } from './shared.ts';
import { createBinding } from './worker.ts';

export function ensureBinding(definition: RegisteredJobDefinition) {
    const queueBindings = getQueueBindings();
    const existing = queueBindings.get(definition.slug);

    if (existing) {
        return existing;
    }

    const binding = createBinding(definition);
    queueBindings.set(definition.slug, binding);
    return binding;
}

export function getJobBinding(slug: RegisteredJobSlug) {
    const queueBindings = getQueueBindings();
    const binding = queueBindings.get(slug);

    if (binding) {
        return binding;
    }

    const definition = jobDefinitions.find((candidate) => candidate.slug === slug);

    if (!definition) {
        throw new Error(`Unknown job "${slug}".`);
    }

    return ensureBinding(definition);
}

export function getRegisteredJobDefinitions() {
    return jobDefinitions;
}
