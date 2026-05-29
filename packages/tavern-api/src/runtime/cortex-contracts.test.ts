import { describe, expect, it } from 'bun:test';
import { cortexSaveSchemaInputSchema, cortexSchemaRecordSchema } from './contracts.js';

describe('Cortex runtime contracts', () => {
    it('validates editable schema definitions', () => {
        const input = cortexSaveSchemaInputSchema.parse({
            schema: {
                frontmatterMappings: [
                    { fields: ['platforms'], linkType: 'uses', pageType: 'product' },
                ],
                linkTypes: [{ name: 'mentions' }, { name: 'uses' }],
                name: 'business-schema',
                pageTypes: ['product', 'note'],
                version: 1,
            },
        });

        expect(input.schema.frontmatterMappings[0]?.linkType).toBe('uses');
    });

    it('validates active schema records returned by Runtime', () => {
        expect(
            cortexSchemaRecordSchema.parse({
                createdAt: '2026-05-28T12:00:00.000Z',
                id: 'ctxschema_1',
                schema: {
                    frontmatterMappings: [],
                    linkTypes: [{ name: 'mentions' }],
                    name: 'business-schema',
                    pageTypes: ['note'],
                    version: 1,
                },
                status: 'active',
                updatedAt: '2026-05-28T12:00:00.000Z',
            }).schema.name
        ).toBe('business-schema');
    });
});
