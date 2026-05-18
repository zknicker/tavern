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
            '/api/activity',
            '/api/chats',
            '/api/chats/{chat_id}',
            '/api/chats/{chat_id}/messages',
            '/api/chats/{chat_id}/deliveries',
            '/api/chats/{chat_id}/activity',
            '/api/chats/{chat_id}/read',
            '/api/messages/{message_id}',
            '/api/events',
            '/api/events/ws',
        ]);
    });

    it('defines durable chat identity schemas', () => {
        expect(document.components?.schemas).toHaveProperty('Chat');
        expect(document.components?.schemas).toHaveProperty('ChatMessage');
        expect(document.components?.schemas).toHaveProperty('ChatEvent');
        expect(document.components?.schemas).toHaveProperty('ChatMessageReceipt');
    });
});
