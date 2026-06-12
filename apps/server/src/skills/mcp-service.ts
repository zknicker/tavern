import type { AgentRuntimeSkillHubActionResult } from '@tavern/api';
import {
    addAgentRuntimeMcpServer,
    getAgentRuntimeMcpCatalog,
    installAgentRuntimeMcpCatalogEntry,
    listAgentRuntimeMcpServers,
    removeAgentRuntimeMcpServer,
    setAgentRuntimeMcpServerEnabled,
    testAgentRuntimeMcpServer,
} from '../agent-runtime/mcp.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import {
    mcpCatalogInstallInputSchema,
    mcpServerCreateInputSchema,
    mcpServerEnabledInputSchema,
    mcpServerNameInputSchema,
} from './contracts.ts';

export async function listMcpServers() {
    return requireRuntime(await listAgentRuntimeMcpServers());
}

export async function addMcpServer(input: unknown) {
    const parsed = mcpServerCreateInputSchema.parse(input);
    const server = requireRuntime(await addAgentRuntimeMcpServer(parsed));
    emitSkillInvalidationCascade();
    return server;
}

export async function removeMcpServer(input: unknown) {
    const parsed = mcpServerNameInputSchema.parse(input);
    const result = requireRuntime(await removeAgentRuntimeMcpServer(parsed.name));
    emitSkillInvalidationCascade();
    return result;
}

export async function testMcpServer(input: unknown) {
    const parsed = mcpServerNameInputSchema.parse(input);
    return requireRuntime(await testAgentRuntimeMcpServer(parsed.name));
}

export async function setMcpServerEnabled(input: unknown) {
    const parsed = mcpServerEnabledInputSchema.parse(input);
    const result = requireRuntime(
        await setAgentRuntimeMcpServerEnabled(parsed.name, parsed.enabled)
    );
    emitSkillInvalidationCascade();
    return result;
}

export async function getMcpCatalog() {
    return requireRuntime(await getAgentRuntimeMcpCatalog());
}

export async function installMcpCatalogEntry(input: unknown) {
    const parsed = mcpCatalogInstallInputSchema.parse(input);
    const result = requireRuntime(await installAgentRuntimeMcpCatalogEntry(parsed));
    if (!result.ok) {
        throw new Error(formatActionFailure(result));
    }
    emitSkillInvalidationCascade();
    return result;
}

function requireRuntime<Result>(result: Result | null): Result {
    if (result === null) {
        throw new Error('MCP servers are unavailable while the runtime is offline.');
    }
    return result;
}

function formatActionFailure(result: AgentRuntimeSkillHubActionResult) {
    const tail = result.log
        .filter((line) => line.trim().length > 0)
        .slice(-4)
        .join(' ');
    return tail.length > 0 ? `MCP install failed: ${tail}` : 'MCP install failed.';
}
