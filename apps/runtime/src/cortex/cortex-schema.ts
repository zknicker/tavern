import {
    type CortexSchemaDefinition,
    type CortexSchemaRecord,
    type CortexSchemaValidationIssue,
    defaultCortexSchema,
} from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { createCortexId } from './ids';
import { nowIso, readJsonRecord } from './rows';

export type { CortexSchemaDefinition } from '@tavern/api';

export function getActiveCortexSchema(db: Database): CortexSchemaDefinition {
    return getActiveCortexSchemaRecord(db).schema;
}

export function getActiveCortexSchemaRecord(db: Database): CortexSchemaRecord {
    ensureDefaultCortexSchema(db);
    const row = db
        .prepare(
            `SELECT id, schema_json, status, created_at, updated_at
             FROM cortex_schemas
             WHERE status = 'active'
             ORDER BY updated_at DESC
             LIMIT 1`
        )
        .get() as {
        created_at: string;
        id: string;
        schema_json: string;
        status: 'active' | 'archived';
        updated_at: string;
    } | null;
    if (!row) {
        const now = nowIso();
        return {
            createdAt: now,
            id: 'ctxschema_default',
            schema: defaultCortexSchema,
            status: 'active',
            updatedAt: now,
            validation: [],
        };
    }
    return toCortexSchemaRecord(row);
}

export function saveActiveCortexSchema(
    db: Database,
    schema: CortexSchemaDefinition
): CortexSchemaRecord {
    const now = nowIso();
    const normalized = normalizeSchema(schema);
    const validation = validateCortexSchemaUpdate(db, normalized);
    const error = validation.find((issue) => issue.severity === 'error');
    if (error) {
        throw new Error(error.message);
    }
    const active = getActiveCortexSchemaRecord(db);
    const nextSchema = { ...normalized, version: active.schema.version + 1 };
    db.prepare(
        "UPDATE cortex_schemas SET status = 'archived', updated_at = ? WHERE status = 'active'"
    ).run(now);
    db.prepare(
        `UPDATE cortex_schemas
         SET name = name || '@' || id
         WHERE status = 'archived'
           AND name = $name`
    ).run(namedParams({ name: nextSchema.name }));
    db.prepare(
        `INSERT INTO cortex_schemas
         (id, name, version, schema_json, status, created_at, updated_at)
         VALUES ($id, $name, $version, $schemaJson, 'active', $createdAt, $updatedAt)`
    ).run(
        namedParams({
            createdAt: now,
            id: createCortexId('ctxschema'),
            name: nextSchema.name,
            schemaJson: JSON.stringify(nextSchema),
            updatedAt: now,
            version: nextSchema.version,
        })
    );
    const record = getActiveCortexSchemaRecord(db);
    writeCortexAudit(db, {
        kind: 'schema.update',
        recordRefs: [record.id],
        sourceRefs: [],
        status: 'success',
        summary: `Updated Cortex schema ${record.schema.name} v${record.schema.version}.`,
    });
    return { ...record, validation };
}

export function isKnownCortexLinkType(schema: CortexSchemaDefinition, linkType: string): boolean {
    return schema.linkTypes.some((type) => type.name === linkType);
}

function ensureDefaultCortexSchema(db: Database): void {
    const now = nowIso();
    db.prepare(
        `INSERT INTO cortex_schemas
         (id, name, version, schema_json, status, created_at, updated_at)
         VALUES ('ctxschema_default', $name, $version, $schemaJson, 'active', $createdAt, $updatedAt)
         ON CONFLICT(id) DO NOTHING`
    ).run(
        namedParams({
            createdAt: now,
            name: defaultCortexSchema.name,
            schemaJson: JSON.stringify(defaultCortexSchema),
            updatedAt: now,
            version: defaultCortexSchema.version,
        })
    );
}

function toCortexSchemaRecord(row: {
    created_at: string;
    id: string;
    schema_json: string;
    status: 'active' | 'archived';
    updated_at: string;
}): CortexSchemaRecord {
    return {
        createdAt: row.created_at,
        id: row.id,
        schema: normalizeSchema(readJsonRecord(row.schema_json)),
        status: row.status,
        updatedAt: row.updated_at,
        validation: [],
    };
}

export function validateCortexSchemaUpdate(
    db: Database,
    schema: CortexSchemaDefinition
): CortexSchemaValidationIssue[] {
    const normalized = normalizeSchema(schema);
    const knownLinkTypes = new Set(normalized.linkTypes.map((type) => type.name));
    const issues: CortexSchemaValidationIssue[] = [];
    for (const mapping of normalized.frontmatterMappings) {
        if (!knownLinkTypes.has(mapping.linkType)) {
            issues.push({
                affectedCount: mapping.fields.length,
                kind: 'invalid-frontmatter-mapping',
                message: `Frontmatter mapping points at missing link type ${mapping.linkType}.`,
                severity: 'error',
                value: mapping.linkType,
            });
        }
    }
    const activeLinkTypes = db
        .prepare('SELECT link_kind, COUNT(*) AS count FROM cortex_links GROUP BY link_kind')
        .all() as Array<{ count: number; link_kind: string }>;
    for (const row of activeLinkTypes) {
        if (!knownLinkTypes.has(row.link_kind)) {
            issues.push({
                affectedCount: row.count,
                kind: 'removed-active-link-type',
                message: `Existing Cortex links use removed link type ${row.link_kind}.`,
                severity: 'warning',
                value: row.link_kind,
            });
        }
    }
    return issues;
}

function normalizeSchema(value: unknown): CortexSchemaDefinition {
    if (!(value && typeof value === 'object')) {
        return defaultCortexSchema;
    }
    const schema = value as Partial<CortexSchemaDefinition>;
    const linkTypes = Array.isArray(schema.linkTypes)
        ? schema.linkTypes.flatMap((type) =>
              typeof type?.name === 'string' && type.name.trim() ? [{ name: type.name.trim() }] : []
          )
        : defaultCortexSchema.linkTypes;
    return {
        frontmatterMappings: Array.isArray(schema.frontmatterMappings)
            ? schema.frontmatterMappings.flatMap(normalizeFrontmatterMapping)
            : defaultCortexSchema.frontmatterMappings,
        linkTypes,
        name: typeof schema.name === 'string' && schema.name.trim() ? schema.name : 'cortex-base',
        pageTypes: Array.isArray(schema.pageTypes)
            ? schema.pageTypes.filter((type): type is string => typeof type === 'string' && !!type)
            : defaultCortexSchema.pageTypes,
        version: Number.isInteger(schema.version) ? Number(schema.version) : 1,
    };
}

type CortexSchemaFrontmatterMapping = CortexSchemaDefinition['frontmatterMappings'][number];

function normalizeFrontmatterMapping(value: unknown): CortexSchemaFrontmatterMapping[] {
    if (!(value && typeof value === 'object')) {
        return [];
    }
    const mapping = value as Partial<CortexSchemaFrontmatterMapping>;
    if (typeof mapping.linkType !== 'string' || !mapping.linkType.trim()) {
        return [];
    }
    const fields = Array.isArray(mapping.fields)
        ? mapping.fields.filter((field): field is string => typeof field === 'string' && !!field)
        : [];
    if (fields.length === 0) {
        return [];
    }
    return [
        {
            fields,
            linkType: mapping.linkType.trim(),
            pageType:
                typeof mapping.pageType === 'string' && mapping.pageType.trim()
                    ? mapping.pageType.trim()
                    : undefined,
        },
    ];
}
