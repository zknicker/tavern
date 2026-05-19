import { enforceAgentToolsFixup } from './enforce-agent-tools.ts';
import { enforceGatewayFixup } from './enforce-gateway.ts';
import { enforceMemoryFixup } from './enforce-memory.ts';
import { enforcePluginAllowFixup } from './enforce-plugin-allow.ts';
import type { AppliedOpenClawConfigFixup, OpenClawConfigFixupContext } from './types.ts';

const openClawConfigFixups = [
    enforceGatewayFixup,
    enforceMemoryFixup,
    enforcePluginAllowFixup,
    enforceAgentToolsFixup,
];

export async function runOpenClawConfigFixups(input: {
    config: Record<string, unknown>;
    context: OpenClawConfigFixupContext;
}) {
    const applied: AppliedOpenClawConfigFixup[] = [];
    let config = input.config;

    for (const fixup of openClawConfigFixups) {
        const result = await fixup.apply({
            config,
            context: input.context,
        });

        config = result.config;
        if (result.changed) {
            applied.push({
                id: fixup.id,
                label: fixup.label,
                message: result.message,
            });
        }
    }

    return {
        applied,
        changed: applied.length > 0,
        config,
    };
}
