import { OpenClawUnsupportedError } from '../gateway/errors.ts';

export function unsupportedOpenClawSurface(surface: string): never {
    throw new OpenClawUnsupportedError(`OpenClaw Gateway does not expose Tavern ${surface}.`);
}
