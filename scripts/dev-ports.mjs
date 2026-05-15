const defaultServerPort = '8080';
const defaultWebsitePort = '3100';

export function resolveDevPorts({
    baseEnvironment = process.env,
    port,
    serverPort,
    websitePort,
} = {}) {
    const resolvedWebsitePort =
        websitePort ?? baseEnvironment.TAVERN_WEBSITE_PORT ?? port ?? defaultWebsitePort;
    const resolvedServerPort =
        serverPort ??
        baseEnvironment.TAVERN_SERVER_PORT ??
        (port ? incrementPort(port) : defaultServerPort);

    return {
        serverPort: parsePort(resolvedServerPort, 'backend port'),
        websitePort: parsePort(resolvedWebsitePort, 'vite port'),
    };
}

export function getDevEnvironment({
    baseEnvironment = process.env,
    port,
    serverPort,
    websitePort,
} = {}) {
    const resolvedPorts = resolveDevPorts({
        baseEnvironment,
        port,
        serverPort,
        websitePort,
    });

    return {
        ...baseEnvironment,
        TAVERN_SERVER_PORT: resolvedPorts.serverPort,
        TAVERN_WEBSITE_PORT: resolvedPorts.websitePort,
    };
}

function incrementPort(value) {
    const numericValue = Number(parsePort(value, 'port'));

    if (numericValue >= 65_535) {
        throw new Error('Expected a valid port below 65535 so the backend port can be derived.');
    }

    return String(numericValue + 1);
}

function parsePort(value, label) {
    if (!/^\d+$/u.test(value)) {
        throw new Error(`Expected a valid ${label}, received "${value}".`);
    }

    const numericValue = Number(value);

    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 65_535) {
        throw new Error(`Expected a valid ${label}, received "${value}".`);
    }

    return value;
}
