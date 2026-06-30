import {
    agentRuntimeMcpCatalogInstallSchema,
    agentRuntimeMcpServerCreateSchema,
} from '@tavern/api';
import { z } from 'zod';

export const mcpServerCreateInputSchema = agentRuntimeMcpServerCreateSchema;

export const mcpServerNameInputSchema = z.object({
    name: z.string().trim().min(1).max(100),
});

export const mcpServerEnabledInputSchema = z.object({
    enabled: z.boolean(),
    name: z.string().trim().min(1).max(100),
});

export const mcpCatalogInstallInputSchema = agentRuntimeMcpCatalogInstallSchema;
