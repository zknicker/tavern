import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../db/index.ts';
import { tavernVaultSecretsTable } from '../db/schema.ts';

export const tavernVaultSecretIds = {
    claudeCredential: 'model-access:claude-code',
    codexCredential: 'model-access:codex',
    openRouterSettings: 'model-access:openrouter',
} as const;

export function getSkillEnvSecretId(input: { envName: string; skillPackageId: string }) {
    return `skill:${input.skillPackageId}:env:${input.envName}`;
}

export async function getTavernVaultSecret<T>(input: { id: string; schema: z.ZodType<T> }) {
    const [record] = await db
        .select()
        .from(tavernVaultSecretsTable)
        .where(eq(tavernVaultSecretsTable.id, input.id))
        .limit(1);

    if (!record) {
        return null;
    }

    return {
        secret: input.schema.parse(JSON.parse(record.secretJson)),
        updatedAt: record.updatedAt,
    };
}

export async function saveTavernVaultSecret(input: { id: string; secret: unknown }) {
    const timestamp = new Date().toISOString();
    const row = {
        id: input.id,
        secretJson: JSON.stringify(input.secret),
        updatedAt: timestamp,
    };

    await db
        .insert(tavernVaultSecretsTable)
        .values({
            createdAt: timestamp,
            id: row.id,
            secretJson: row.secretJson,
            updatedAt: row.updatedAt,
        })
        .onConflictDoUpdate({
            target: tavernVaultSecretsTable.id,
            set: {
                secretJson: row.secretJson,
                updatedAt: row.updatedAt,
            },
        });

    return {
        updatedAt: timestamp,
    };
}

export async function deleteTavernVaultSecret(id: string) {
    await db.delete(tavernVaultSecretsTable).where(eq(tavernVaultSecretsTable.id, id));
}
