import { HERMES_DASHBOARD_SESSION_TOKEN, readConfigValue } from '../config';
import { defaultHermesHost, defaultHermesPort } from './constants';
import type { LocalHermesClientOptions } from './protocol';

export function readHermesConnectionOptions(): LocalHermesClientOptions {
    const host = readConfigValue('TAVERN_HERMES_HOST') ?? defaultHermesHost;
    const port = readConfigValue('TAVERN_HERMES_PORT') ?? defaultHermesPort;
    return {
        baseUrl: `http://${host}:${port}`,
        token: readConfigValue('TAVERN_HERMES_TOKEN') ?? HERMES_DASHBOARD_SESSION_TOKEN,
    };
}
