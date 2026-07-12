import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { listAgents, requirePrimaryAgent } from '../agents/catalog.ts';
import {
    archiveChatResultSchema,
    type CreateChatInput,
    createChatInputSchema,
    createChatResultSchema,
    type UpdateChatInput,
    type UpdateChatSystemPromptInput,
    type UpdateChatTabAppearanceInput,
    unarchiveChatResultSchema,
    updateChatInputSchema,
    updateChatSystemPromptInputSchema,
    updateChatSystemPromptResultSchema,
    updateChatTabAppearanceInputSchema,
    updateChatTabAppearanceResultSchema,
} from './contracts.ts';
import {
    createRuntimeTavernChat,
    getRuntimeChatRecord,
    setRuntimeTavernChatArchived,
    type TavernChatDisplayNameSource,
    updateRuntimeTavernChat,
    updateRuntimeTavernChatSystemPrompt,
    updateRuntimeTavernChatTabAppearance,
} from './runtime-chats.ts';
import { createChatTiming } from './timing.ts';

const uniqueAgentIdsSchema = z
    .array(z.string().trim().min(1))
    .min(1)
    .transform((agentIds) => [...new Set(agentIds)]);

function buildChatId() {
    return `cht_${randomUUID()}`;
}

async function resolveAgentRuntimeBindings(agentIds: string[] | undefined) {
    if (!(agentIds && agentIds.length > 0)) {
        const agent = await requirePrimaryAgent();
        return {
            agentIds: [agent.id],
            runtimeId: agent.runtimeId,
        };
    }

    const tavernAgentIds = agentIds;
    const agentsById = new Map((await listAgents()).map((agent) => [agent.id, agent] as const));
    const agents = tavernAgentIds.map((agentId) => agentsById.get(agentId) ?? null);
    const missingAgentIds = tavernAgentIds.filter((_, index) => !agents[index]);

    if (missingAgentIds.length > 0) {
        throw new Error(`Unknown Tavern agents: ${missingAgentIds.join(', ')}`);
    }

    const runtimeIds = new Set(agents.map((agent) => agent?.runtimeId).filter(Boolean));

    if (runtimeIds.size !== 1) {
        throw new Error('Tavern chats can only bind agents from one runtime.');
    }

    return {
        agentIds: agents.map((agent) => agent?.id ?? ''),
        runtimeId: [...runtimeIds][0] ?? '',
    };
}

export async function createTavernChat(
    input: CreateChatInput & { displayNameSource?: TavernChatDisplayNameSource }
) {
    const logTiming = createChatTiming('chat.create');
    const parsed = createChatInputSchema.parse(input);
    const agentIds = parsed.agentIds ? uniqueAgentIdsSchema.parse(parsed.agentIds) : undefined;
    const binding = await resolveAgentRuntimeBindings(agentIds);
    logTiming('tavern.resolveAgentRuntimeBindings', { runtimeId: binding.runtimeId });

    const chatId = buildChatId();
    await createRuntimeTavernChat({
        agentIds: binding.agentIds,
        displayName: parsed.displayName,
        displayNameSource: input.displayNameSource ?? 'explicit',
        id: chatId,
    });
    logTiming('tavern.saveChatRecord', { chatId });

    const result = createChatResultSchema.parse({
        chatId,
    });
    logTiming('tavern.createComplete', { chatId: result.chatId });

    return result;
}

export async function updateTavernChat(input: UpdateChatInput) {
    const parsed = updateChatInputSchema.parse(input);
    const agentIds = uniqueAgentIdsSchema.parse(parsed.agentIds);
    const binding = await resolveAgentRuntimeBindings(agentIds);
    const existing = await getRuntimeChatRecord(parsed.chatId);

    if (existing && existing.runtimeId !== binding.runtimeId) {
        throw new Error('Tavern chats cannot move between runtime namespaces.');
    }

    await updateRuntimeTavernChat({
        agentIds: binding.agentIds,
        displayName: parsed.displayName,
        id: parsed.chatId,
    });

    return createChatResultSchema.parse({
        chatId: parsed.chatId,
    });
}

export async function archiveTavernChat(chatId: string) {
    const chat = await getRuntimeChatRecord(chatId);

    if (!chat) {
        throw new Error(`No Tavern chat named "${chatId}" exists.`);
    }

    await setRuntimeTavernChatArchived(chat.chat.id, true);

    return archiveChatResultSchema.parse({
        archived: true,
        chatId,
    });
}

export async function unarchiveTavernChat(chatId: string) {
    const chat = await getRuntimeChatRecord(chatId);

    if (!chat) {
        throw new Error(`No Tavern chat named "${chatId}" exists.`);
    }

    await setRuntimeTavernChatArchived(chat.chat.id, false);

    return unarchiveChatResultSchema.parse({
        archived: false,
        chatId,
    });
}

export async function updateTavernChatTabAppearance(input: UpdateChatTabAppearanceInput) {
    const parsed = updateChatTabAppearanceInputSchema.parse(input);
    const chat = await getRuntimeChatRecord(parsed.chatId);

    if (!chat) {
        throw new Error(`No Tavern chat named "${parsed.chatId}" exists.`);
    }

    if (chat.chat.platform !== 'tavern' || chat.chat.scope !== 'channel') {
        throw new Error('Only Tavern channels can customize channel color.');
    }

    await updateRuntimeTavernChatTabAppearance({
        chatId: parsed.chatId,
        tabAppearance: {
            color: parsed.color,
        },
    });

    return updateChatTabAppearanceResultSchema.parse({
        chatId: parsed.chatId,
        tabAppearance: {
            color: parsed.color,
        },
    });
}

export async function updateTavernChatSystemPrompt(input: UpdateChatSystemPromptInput) {
    const parsed = updateChatSystemPromptInputSchema.parse(input);
    const chat = await getRuntimeChatRecord(parsed.chatId);

    if (!chat) {
        throw new Error(`No Tavern chat named "${parsed.chatId}" exists.`);
    }

    if (chat.chat.platform !== 'tavern') {
        throw new Error('Only Tavern chats can customize system prompts.');
    }

    await updateRuntimeTavernChatSystemPrompt({
        chatId: parsed.chatId,
        systemPrompt: parsed.systemPrompt,
    });

    return updateChatSystemPromptResultSchema.parse({
        chatId: parsed.chatId,
        systemPrompt: parsed.systemPrompt,
    });
}
