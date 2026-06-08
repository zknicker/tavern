export interface HermesSseEvent {
    data: Record<string, unknown>;
    event: string;
}

export interface LocalHermesClientOptions {
    baseUrl: string;
    token: string | null;
}
