export * from './contracts.ts';
export * from './ids.ts';
export * from './merchbase/manifest.ts';

import { merchbasePluginManifest } from './merchbase/manifest.ts';

export const tavernPluginManifests = [merchbasePluginManifest] as const;
