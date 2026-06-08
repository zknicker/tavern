import { enforceAgentToolsFixup } from './enforce-agent-tools.ts';
import { enforceGatewayFixup } from './enforce-gateway.ts';
import { enforceMemoryFixup } from './enforce-memory.ts';
import { enforcePluginAllowFixup } from './enforce-plugin-allow.ts';
import type { AppliedHermesConfigFixup, HermesConfigFixupContext } from './types.ts';

const hermesConfigFixups = [
    enforceGatewayFixup,
    enforceMemoryFixup,
    enforcePluginAllowFixup,
    enforceAgentToolsFixup,
];

export async function runHermesConfigFixups(input: {
    config: Record<string, unknown>;
    context: HermesConfigFixupContext;
}) {
    const applied: AppliedHermesConfigFixup[] = [];
    let config = input.config;

    for (const fixup of hermesConfigFixups) {
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
