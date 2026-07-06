export * from './contracts.ts';
export * from './google/manifest.ts';
export * from './ids.ts';
export * from './merchbase/manifest.ts';

import { googlePluginManifest } from './google/manifest.ts';
import { merchbasePluginManifest } from './merchbase/manifest.ts';

export const tavernPluginManifests = [merchbasePluginManifest, googlePluginManifest] as const;
