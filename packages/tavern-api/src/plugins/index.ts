export * from './browser/manifest.ts';
export * from './contracts.ts';
export * from './google/manifest.ts';
export * from './ids.ts';
export * from './merchbase/manifest.ts';

import { browserPluginManifest } from './browser/manifest.ts';
import { googlePluginManifest } from './google/manifest.ts';
import { merchbasePluginManifest } from './merchbase/manifest.ts';

export const tavernPluginManifests = [
    merchbasePluginManifest,
    googlePluginManifest,
    browserPluginManifest,
] as const;
