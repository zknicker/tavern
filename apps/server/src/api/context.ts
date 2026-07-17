export interface ApiContext {
    /**
     * Clerk session token forwarded by the app. HTTP requests carry it as an
     * `Authorization: Bearer` header; websocket connections pass it via tRPC
     * connectionParams. Null in keyless dev mode.
     */
    clerkSessionToken: string | null;
}

interface ContextCarrier {
    info?: { connectionParams?: Record<string, string | undefined> | null } | null;
    req?: { headers?: Record<string, string | string[] | undefined> } | null;
}

export function createApiContext(opts?: ContextCarrier): ApiContext {
    const fromConnection = opts?.info?.connectionParams?.clerkSessionToken;
    if (typeof fromConnection === 'string' && fromConnection.length > 0) {
        return { clerkSessionToken: fromConnection };
    }
    const header = opts?.req?.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (typeof value === 'string' && value.startsWith('Bearer ')) {
        return { clerkSessionToken: value.slice(7) };
    }
    return { clerkSessionToken: null };
}
