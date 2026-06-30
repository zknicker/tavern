import { curatedCodexModels } from '../curated/codex.ts';
import {
    curatedCatalog,
    type ModelCatalogProvider,
    type ModelCatalogResult,
    missingCliCatalogWarning,
} from './shared.ts';

export function resolveCodexModelCatalog(input: {
    command: string;
    provider: ModelCatalogProvider;
}): ModelCatalogResult {
    const warning = missingCliCatalogWarning(input);
    if (warning) {
        return curatedCatalog(input.provider, curatedCodexModels, {
            availability: 'unavailable',
            warning,
        });
    }

    return curatedCatalog(input.provider, curatedCodexModels);
}
