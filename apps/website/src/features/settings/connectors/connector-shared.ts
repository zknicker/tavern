import type { ConnectorListOutput, ConnectorSaveInput } from '../../../lib/trpc.tsx';

export type Connector = ConnectorListOutput['connectors'][number];
export type ConnectorTransport = Connector['transport'];

export interface SecretDraftEntry {
    key: string;
    name: string;
    value: string;
}

export interface ConnectorDraft {
    args: string;
    command: string;
    env: SecretDraftEntry[];
    headers: SecretDraftEntry[];
    name: string;
    timeoutSeconds: string;
    transport: ConnectorTransport;
    url: string;
}

export function splitArgs(value: string): string[] {
    return value.split(/\s+/u).filter((part) => part.length > 0);
}

export function joinArgs(args: string[]): string {
    return args.join(' ');
}

/**
 * Build save-input secret entries. Names are trimmed and empties dropped. A
 * blank value for a name that already exists in the saved list omits the
 * value so the stored secret is kept; anything else sends the typed value.
 */
export function toSecretFieldInputs(
    entries: { name: string; value: string }[],
    saved: { hasValue: boolean; name: string }[]
): { name: string; value?: string }[] {
    const savedNames = new Set(saved.map((field) => field.name));

    return entries
        .map((entry) => ({ name: entry.name.trim(), value: entry.value }))
        .filter((entry) => entry.name.length > 0)
        .map((entry) =>
            entry.value === '' && savedNames.has(entry.name)
                ? { name: entry.name }
                : { name: entry.name, value: entry.value }
        );
}

export function connectorSummary(connector: Connector): string {
    if (connector.transport === 'command') {
        const parts = [connector.command ?? '', joinArgs(connector.args)].filter(Boolean);
        return `command: ${parts.join(' ')}`;
    }

    return connector.url ? urlHost(connector.url) : 'url';
}

function urlHost(value: string): string {
    try {
        return new URL(value).host;
    } catch {
        return value;
    }
}

export function createConnectorDraft(connector: Connector | null): ConnectorDraft {
    return {
        args: joinArgs(connector?.args ?? []),
        command: connector?.command ?? '',
        env: toSecretDraftEntries(connector?.env ?? []),
        headers: toSecretDraftEntries(connector?.headers ?? []),
        name: connector?.name ?? '',
        timeoutSeconds: connector?.timeoutSeconds ? String(connector.timeoutSeconds) : '',
        transport: connector?.transport ?? 'command',
        url: connector?.url ?? '',
    };
}

export function buildSaveInput(draft: ConnectorDraft, saved: Connector | null): ConnectorSaveInput {
    return {
        args: draft.transport === 'command' ? splitArgs(draft.args) : [],
        command: draft.transport === 'command' ? draft.command.trim() || null : null,
        env: toSecretFieldInputs(draft.env, saved?.env ?? []),
        headers: toSecretFieldInputs(draft.headers, saved?.headers ?? []),
        name: draft.name.trim(),
        timeoutSeconds: parseTimeoutSeconds(draft.timeoutSeconds),
        transport: draft.transport,
        url: draft.transport === 'url' ? draft.url.trim() || null : null,
    };
}

export function createSecretDraftEntry(): SecretDraftEntry {
    return { key: crypto.randomUUID(), name: '', value: '' };
}

function toSecretDraftEntries(saved: { name: string }[]): SecretDraftEntry[] {
    return saved.map((field) => ({ key: crypto.randomUUID(), name: field.name, value: '' }));
}

function parseTimeoutSeconds(value: string): null | number {
    const trimmed = value.trim();

    if (!trimmed) {
        return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
}
