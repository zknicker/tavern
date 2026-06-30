import { createHash } from 'node:crypto';

const defaultServerPort = '8080';
const defaultWebsitePort = '3100';
const defaultRuntimePort = '18790';
const devPortGroupBase = 20_000;
const devPortGroupCount = 8000;

export function resolveDevPorts({
    baseEnvironment = process.env,
    port,
    repositoryRoot = process.cwd(),
    serverPort,
    websitePort,
} = {}) {
    const portBase = resolveDevPortBase({ baseEnvironment, repositoryRoot });
    const resolvedWebsitePort =
        websitePort ??
        baseEnvironment.TAVERN_WEBSITE_PORT ??
        port ??
        (hasExplicitDevPortInput({ baseEnvironment, port, serverPort, websitePort })
            ? defaultWebsitePort
            : String(portBase));
    const resolvedServerPort =
        serverPort ??
        baseEnvironment.TAVERN_SERVER_PORT ??
        (port
            ? incrementPort(port)
            : hasExplicitDevPortInput({ baseEnvironment, port, serverPort, websitePort })
              ? defaultServerPort
              : String(portBase + 1));
    const resolvedRuntimePort =
        baseEnvironment.TAVERN_RUNTIME_PORT ??
        (hasExplicitDevPortInput({ baseEnvironment, port, serverPort, websitePort })
            ? defaultRuntimePort
            : String(portBase + 2));
    return {
        runtimePort: parsePort(resolvedRuntimePort, 'runtime port'),
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
        TAVERN_RUNTIME_PORT: resolvedPorts.runtimePort,
        TAVERN_SERVER_PORT: resolvedPorts.serverPort,
        TAVERN_WEBSITE_PORT: resolvedPorts.websitePort,
    };
}

function resolveDevPortBase({ baseEnvironment, repositoryRoot }) {
    const explicitBase = baseEnvironment.TAVERN_DEV_PORT_BASE;
    if (explicitBase) {
        const parsed = Number(parsePort(explicitBase, 'dev port base'));
        if (parsed > 65_532) {
            throw new Error('Expected TAVERN_DEV_PORT_BASE to leave room for four dev ports.');
        }
        return parsed;
    }

    const portIdentity = baseEnvironment.TAVERN_DEV_STACK_ID
        ? `stack:${baseEnvironment.TAVERN_DEV_STACK_ID}`
        : repositoryRoot;
    const digest = createHash('sha256').update(portIdentity).digest();
    const bucket = digest.readUInt32BE(0) % devPortGroupCount;
    return devPortGroupBase + bucket * 4;
}

function hasExplicitDevPortInput({ baseEnvironment, port, serverPort, websitePort }) {
    return Boolean(
        port ??
            serverPort ??
            websitePort ??
            baseEnvironment.TAVERN_SERVER_PORT ??
            baseEnvironment.TAVERN_WEBSITE_PORT
    );
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
