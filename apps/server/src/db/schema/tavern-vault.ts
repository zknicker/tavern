import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tavernVaultSecretsTable = sqliteTable('tavern_vault_secrets', {
    createdAt: text('created_at').notNull(),
    id: text('id').primaryKey(),
    secretJson: text('secret_json').notNull(),
    updatedAt: text('updated_at').notNull(),
});
