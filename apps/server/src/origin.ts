import { env } from './config/env.ts';

export function isAllowedAppOrigin(origin: string | undefined) {
    if (!origin) {
        return true;
    }

    if (origin === env.APP_ORIGIN) {
        return true;
    }

    try {
        const url = new URL(origin);

        return (
            origin === 'file://' ||
            url.protocol === 'file:' ||
            url.hostname === '127.0.0.1' ||
            url.hostname === 'localhost'
        );
    } catch {
        return false;
    }
}
