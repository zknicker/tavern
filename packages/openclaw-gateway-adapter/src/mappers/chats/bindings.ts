import {
    type AgentRuntimeArchiveBinding,
    type AgentRuntimeBinding,
    type AgentRuntimeBindingList,
    type AgentRuntimeUpsertBinding,
    agentRuntimeArchiveBindingSchema,
    agentRuntimeBindingListSchema,
    agentRuntimeBindingSchema,
} from '@tavern/api';
import { nowIso } from '../../gateway/records.ts';

export function mapOpenClawBindingList(): AgentRuntimeBindingList {
    return agentRuntimeBindingListSchema.parse({ bindings: [] });
}

export function mapTavernBindingToOpenClawProjection(
    input: AgentRuntimeUpsertBinding
): AgentRuntimeBinding {
    return agentRuntimeBindingSchema.parse({
        agentId: input.agentId,
        enabled: input.enabled ?? true,
        id: input.id,
        inboundMode: input.inboundMode ?? 'active',
        match: input.match ?? {},
        metadata: input.metadata ?? {},
        name: input.name,
        platform: input.platform,
        status: input.status ?? 'configured',
        statusMessage: input.statusMessage ?? null,
        token: input.token,
        updatedAt: nowIso(),
    });
}

export function mapOpenClawDeletedBinding(bindingId: string): AgentRuntimeArchiveBinding {
    return agentRuntimeArchiveBindingSchema.parse({
        archived: true,
        id: bindingId,
    });
}
