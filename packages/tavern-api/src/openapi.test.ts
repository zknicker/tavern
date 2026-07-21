import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const openApiPath = fileURLToPath(new URL('../openapi.yaml', import.meta.url));

describe('Tavern OpenAPI contract', () => {
    const document = parse(readFileSync(openApiPath, 'utf8')) as {
        components?: { schemas?: Record<string, unknown> };
        info?: { title?: string };
        openapi?: string;
        paths?: Record<string, unknown>;
    };

    it('declares the Tavern API document', () => {
        expect(document.openapi).toBe('3.1.0');
        expect(document.info?.title).toBe('Tavern API');
    });

    it('contains the first chat and realtime API slice', () => {
        expect(Object.keys(document.paths ?? {})).toEqual([
            '/api/chats',
            '/api/chats/{chat_id}',
            '/api/chats/{chat_id}/threads',
            '/api/chats/{chat_id}/follow',
            '/api/chats/{chat_id}/messages',
            '/api/chats/{chat_id}/messages/search',
            '/api/chats/{chat_id}/timeline',
            '/api/chats/{chat_id}/responses/{response_id}/evidence',
            '/api/chats/{chat_id}/deliveries',
            '/api/chats/{chat_id}/responses',
            '/api/chats/{chat_id}/responses/{response_id}/activity',
            '/api/chats/{chat_id}/activity/{activity_id}',
            '/api/chats/{chat_id}/artifacts',
            '/api/chats/{chat_id}/read',
            '/api/chats/{chat_id}/clear',
            '/api/responses/{response_id}',
            '/api/messages/{message_id}',
            '/api/turns/{run_id}/prompt',
            '/api/turns/{run_id}/file-changes',
            '/api/events',
            '/api/events/ws',
        ]);
    });

    it('defines durable chat identity schemas', () => {
        expect(document.components?.schemas).toHaveProperty('Chat');
        expect(document.components?.schemas).toHaveProperty('ChatMessage');
        expect(document.components?.schemas).toHaveProperty('ChatResponse');
        expect(document.components?.schemas).toHaveProperty('ResponseActivity');
        expect(document.components?.schemas).toHaveProperty('ChatArtifact');
        expect(document.components?.schemas).toHaveProperty('ChatEvent');
        expect(document.components?.schemas).toHaveProperty('ChatMessageReceipt');
        expect(document.components?.schemas).toHaveProperty('ThreadSummary');
    });
});
