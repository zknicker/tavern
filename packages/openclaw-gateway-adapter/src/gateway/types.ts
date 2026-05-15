export type OpenClawOperatorScope =
    | 'operator.admin'
    | 'operator.approvals'
    | 'operator.pairing'
    | 'operator.read'
    | 'operator.talk.secrets'
    | 'operator.write';

export interface OpenClawGatewayAuth {
    deviceToken?: string;
    password?: string;
    token?: string;
}

export interface OpenClawGatewayDeviceSignerInput {
    authToken?: string;
    clientId: string;
    clientMode: string;
    nonce?: string;
    role: 'operator';
    scopes: OpenClawOperatorScope[];
    signedAt: number;
    version: 'v1' | 'v2';
}

export interface OpenClawGatewayDevice {
    id: string;
    publicKey: string;
    signChallenge: (input: OpenClawGatewayDeviceSignerInput) => Promise<string> | string;
}

export interface OpenClawGatewayOptions {
    auth?: OpenClawGatewayAuth;
    clientId?: string;
    clientMode?: string;
    clientVersion?: string;
    device?: OpenClawGatewayDevice;
    gatewayUrl: string;
    requestTimeoutMs?: number;
    scopes?: OpenClawOperatorScope[];
    userAgent?: string;
}

export interface OpenClawGatewayEvent {
    event: string;
    payload: unknown;
    seq?: number;
    stateVersion?: unknown;
}

export type OpenClawGatewayEventHandler = (event: OpenClawGatewayEvent) => void;

export interface OpenClawGatewayClient {
    close(): void;
    connect(): Promise<void>;
    onClose(handler: () => void): () => void;
    onEvent(handler: OpenClawGatewayEventHandler): () => void;
    request<TPayload = unknown>(method: string, params?: unknown): Promise<TPayload>;
}
