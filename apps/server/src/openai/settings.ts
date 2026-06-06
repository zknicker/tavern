import type { AgentRuntimeOpenAiSettings } from '@tavern/api';
import { AgentRuntimeRequestError } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

export type OpenAiSettings = AgentRuntimeOpenAiSettings;

export async function getOpenAiSettings(): Promise<OpenAiSettings | null> {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        return null;
    }
    try {
        return await client.getOpenAiSettings();
    } catch (error) {
        if (
            error instanceof AgentRuntimeRequestError &&
            (error.retryable || error.status === 404)
        ) {
            return null;
        }
        throw error;
    } finally {
        client.close();
    }
}

export async function saveOpenAiSettings(input: { apiKey: string }): Promise<OpenAiSettings> {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not configured.');
    }
    try {
        return await client.saveOpenAiSettings(input);
    } finally {
        client.close();
    }
}

export async function deleteOpenAiSettings(): Promise<OpenAiSettings> {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not configured.');
    }
    try {
        return await client.deleteOpenAiSettings();
    } finally {
        client.close();
    }
}
