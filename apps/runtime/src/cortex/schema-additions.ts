import type {
    CortexAddSchemaTermInput,
    CortexSchemaAddition,
    CortexSchemaAdditionList,
    CortexSchemaDefinition,
    CortexSourceRef,
} from '@tavern/api';
import { writeCortexAudit } from './audit';
import type { CortexDatabase } from './db';
import { createCortexId } from './ids';
import { nowIso, readJsonArray, readJsonRecord } from './rows';

export async function addCortexSchemaTerm(
    db: CortexDatabase,
    input: CortexAddSchemaTermInput
): Promise<CortexSchemaAddition> {
    const now = nowIso();
    const existing = await findSchemaTerm(db, input.kind, input.name);
    await db
        .prepare(
            `INSERT INTO cortex_schema_terms
             (id, kind, name, reason, example_json, source_refs_json, created_at, updated_at)
             VALUES ($id, $kind, $name, $reason, $exampleJson, $sourceRefsJson, $createdAt, $updatedAt)
             ON CONFLICT(kind, name) DO UPDATE SET
                reason = excluded.reason,
                example_json = excluded.example_json,
                source_refs_json = excluded.source_refs_json,
                updated_at = excluded.updated_at`
        )
        .run({
            createdAt: now,
            exampleJson: JSON.stringify(input.example),
            id: existing?.id ?? createCortexId('ctxterm'),
            kind: input.kind,
            name: input.name,
            reason: input.reason,
            sourceRefsJson: JSON.stringify(input.sourceRefs),
            updatedAt: now,
        });
    const row = await findSchemaTerm(db, input.kind, input.name);
    if (!row) {
        throw new Error('Cortex schema term write did not return a row.');
    }
    if (!existing) {
        await writeCortexAudit(db, {
            kind: 'schema.term.add',
            metadata: {
                kind: input.kind,
                name: input.name,
                reason: input.reason,
            },
            recordRefs: [row.id],
            sourceRefs: input.sourceRefs,
            status: 'success',
            summary: `Added Cortex schema ${input.kind} ${input.name}.`,
        });
    }
    return await toAddition(db, row);
}

export async function listCortexSchemaAdditions(
    db: CortexDatabase
): Promise<CortexSchemaAdditionList> {
    const rows = await db
        .prepare(
            `SELECT id, kind, name, reason, example_json, source_refs_json, created_at, updated_at
             FROM cortex_schema_terms
             ORDER BY updated_at DESC, created_at DESC`
        )
        .all<SchemaTermRow>();
    return { additions: await Promise.all(rows.map((row) => toAddition(db, row))) };
}

export async function deleteUnusedCortexSchemaAddition(
    db: CortexDatabase,
    id: string
): Promise<CortexSchemaAddition> {
    const row = await findSchemaTermById(db, id);
    if (!row) {
        throw new Error(`Cortex schema addition not found: ${id}.`);
    }
    const addition = await toAddition(db, row);
    if (addition.usageCount > 0) {
        throw new Error(`Cortex schema addition is still used: ${addition.name}.`);
    }
    await db.prepare('DELETE FROM cortex_schema_terms WHERE id = ?').run(id);
    await writeCortexAudit(db, {
        kind: 'schema.term.delete',
        metadata: {
            kind: addition.kind,
            name: addition.name,
            reason: addition.reason,
        },
        recordRefs: [addition.id],
        sourceRefs: addition.sourceRefs,
        status: 'success',
        summary: `Deleted unused Cortex schema ${addition.kind} ${addition.name}.`,
    });
    return addition;
}

export async function applyCortexSchemaAdditions(
    db: CortexDatabase,
    schema: CortexSchemaDefinition
): Promise<CortexSchemaDefinition> {
    const rows = await db
        .prepare(
            `SELECT id, kind, name, reason, example_json, source_refs_json, created_at, updated_at
             FROM cortex_schema_terms
             ORDER BY created_at ASC`
        )
        .all<SchemaTermRow>();
    return mergeSchemaTerms(schema, rows);
}

async function findSchemaTerm(
    db: CortexDatabase,
    kind: CortexAddSchemaTermInput['kind'],
    name: string
): Promise<null | SchemaTermRow> {
    return await db
        .prepare(
            `SELECT id, kind, name, reason, example_json, source_refs_json, created_at, updated_at
             FROM cortex_schema_terms
             WHERE kind = $kind AND name = $name
             LIMIT 1`
        )
        .get<SchemaTermRow>({ kind, name });
}

async function findSchemaTermById(db: CortexDatabase, id: string): Promise<null | SchemaTermRow> {
    return await db
        .prepare(
            `SELECT id, kind, name, reason, example_json, source_refs_json, created_at, updated_at
             FROM cortex_schema_terms
             WHERE id = ?
             LIMIT 1`
        )
        .get<SchemaTermRow>(id);
}

async function toAddition(db: CortexDatabase, row: SchemaTermRow): Promise<CortexSchemaAddition> {
    return {
        createdAt: row.created_at,
        example: readJsonRecord(row.example_json),
        id: row.id,
        kind: row.kind,
        name: row.name,
        reason: row.reason,
        sourceRefs: readJsonArray<CortexSourceRef>(row.source_refs_json),
        updatedAt: row.updated_at,
        usageCount: await countSchemaTermUsage(db, row.kind, row.name),
    };
}

async function countSchemaTermUsage(
    db: CortexDatabase,
    kind: CortexAddSchemaTermInput['kind'],
    name: string
): Promise<number> {
    if (kind === 'link-type') {
        const row = await db
            .prepare('SELECT COUNT(*) AS count FROM cortex_links WHERE link_kind = ?')
            .get<{ count: number }>(name);
        return row?.count ?? 0;
    }
    const row = await db
        .prepare(
            "SELECT COUNT(*) AS count FROM cortex_pages WHERE type = ? AND status != 'deleted'"
        )
        .get<{ count: number }>(name);
    return row?.count ?? 0;
}

function mergeSchemaTerms(
    schema: CortexSchemaDefinition,
    rows: SchemaTermRow[]
): CortexSchemaDefinition {
    const pageTypes = new Set(schema.pageTypes);
    const linkTypes = new Set(schema.linkTypes.map((type) => type.name));
    const frontmatterMappingKeys = new Set(
        schema.frontmatterMappings.map(
            (mapping) => `${mapping.linkType}:${mapping.fields.join('|')}`
        )
    );
    const frontmatterMappings = [...schema.frontmatterMappings];

    for (const row of rows) {
        if (row.kind === 'page-type') {
            pageTypes.add(row.name);
        } else {
            linkTypes.add(row.name);
            const mappingKey = `${row.name}:${row.name}`;
            if (!frontmatterMappingKeys.has(mappingKey)) {
                frontmatterMappings.push({ fields: [row.name], linkType: row.name });
                frontmatterMappingKeys.add(mappingKey);
            }
        }
    }

    return {
        ...schema,
        frontmatterMappings,
        linkTypes: [...linkTypes].map((name) => ({ name })),
        pageTypes: [...pageTypes],
    };
}

interface SchemaTermRow {
    created_at: string;
    example_json: string;
    id: string;
    kind: CortexAddSchemaTermInput['kind'];
    name: string;
    reason: string;
    source_refs_json: string;
    updated_at: string;
}
