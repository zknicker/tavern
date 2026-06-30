import { curatedClaudeModels } from '../curated/claude.ts';
import {
    curatedCatalog,
    type ModelCatalogProvider,
    type ModelCatalogResult,
    missingCliCatalogWarning,
} from './shared.ts';

export function resolveClaudeModelCatalog(input: {
    command: string;
    provider: ModelCatalogProvider;
}): ModelCatalogResult {
    const warning = missingCliCatalogWarning(input);
    if (warning) {
        return curatedCatalog(input.provider, curatedClaudeModels, {
            availability: 'unavailable',
            warning,
        });
    }

    return curatedCatalog(input.provider, curatedClaudeModels);
}
