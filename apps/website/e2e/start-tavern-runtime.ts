import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentExecutorInput } from '../../runtime/src/tavern/agent-executor.ts';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const runtimeRoot = path.join(workspaceRoot, '.context', 'e2e', runId, 'tavern-runtime');

rmSync(runtimeRoot, { force: true, recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
mkdirSync(path.join(runtimeRoot, 'agent', 'workspace'), { recursive: true });
writeFileSync(
    path.join(runtimeRoot, 'agent', 'workspace', 'QA_KICKOFF_TASK.md'),
    '# QA kickoff task\n\nThis file exists so e2e tool-read tests can inspect a deterministic workspace fixture.\n'
);

process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
process.env.TAVERN_AGENT_HOME = path.join(runtimeRoot, 'agent');
process.env.TAVERN_AGENT_WORKSPACE = path.join(runtimeRoot, 'agent', 'workspace');
process.env.TAVERN_RUNTIME_TOKEN = process.env.TAVERN_RUNTIME_TOKEN ?? 'e2e-runtime-token';
process.env.NODE_ENV ??= 'test';

process.chdir(workspaceRoot);

const { setAgentExecutorForTesting } = await import(
    '../../runtime/src/tavern/agent-turn-runner.ts'
);
const { createHarnessAgentExecutor, setHarnessAgentFactoryForTesting } = await import(
    '../../runtime/src/tavern/harness-agent-executor.ts'
);

// The e2e mock fakes only the model harness; the real executor runs — real
// instructions, prompt assembly, activity persistence, widget parsing, empty
// and silent-reply handling — so e2e exercises the product turn path.
setHarnessAgentFactoryForTesting(createFakeHarnessAgentFactory());
setAgentExecutorForTesting(createHarnessAgentExecutor());

// The runtime entry dispatches on argv and only starts the server on the `serve` subcommand.
process.argv = [process.argv[0] ?? 'bun', process.argv[1] ?? 'start-tavern-runtime.ts', 'serve'];

await import('../../runtime/src/index.ts');

function createFakeHarnessAgentFactory() {
    return ((input: AgentExecutorInput) => ({
        createSession: () =>
            Promise.resolve({
                destroy: () => Promise.resolve(),
                sessionId:
                    input.agentSession.runtimeSessionId ?? `ses_e2e_${input.agentSession.id}`,
                stop: () => Promise.resolve({}),
            }),
        stream: () =>
            Promise.resolve({ fullStream: e2eTurnParts(input), text: Promise.resolve('') }),
    })) as unknown as Parameters<typeof setHarnessAgentFactoryForTesting>[0];
}

// Marker-driven model behavior. Prompts opt into tools, narration, widgets,
// slowness, or an empty reply; everything else echoes deterministically.
async function* e2eTurnParts(input: AgentExecutorInput) {
    const content = input.content;
    const readTarget = content.match(/(?:Read|against) `([^`]+)`/iu)?.[1] ?? null;
    const slow = /slow QA command/iu.test(content);

    if (readTarget) {
        yield {
            input: { file_path: readTarget },
            toolCallId: 'tool_e2e_read',
            toolName: 'read',
            type: 'tool-call',
        };

        if (slow) {
            await delay(2500);
        }

        yield {
            input: { file_path: readTarget },
            output: '# QA kickoff task',
            toolCallId: 'tool_e2e_read',
            toolName: 'read',
            type: 'tool-result',
        };
    }

    // No text parts at all: the executor's empty-content diagnostic path.
    if (/empty response exhaustion/iu.test(content)) {
        return;
    }

    if (/render a tall table/iu.test(content)) {
        yield* textSegment('txt_narration', 'Investigating variance across regions.');
        yield* streamedTextSegment(
            'txt_reply',
            tallTableReply(parseExactReply(content) ?? 'QA_TABLE_OK')
        );
        return;
    }

    yield* textSegment('txt_reply', e2eResponseContent(input));
}

function* textSegment(id: string, text: string) {
    yield { id, type: 'text-start' };
    yield { id, text, type: 'text-delta' };
    yield { id, type: 'text-end' };
}

// Stream the reply in small paced deltas so live-reveal and follow-scroll
// behavior engage like a real model turn.
async function* streamedTextSegment(id: string, text: string) {
    yield { id, type: 'text-start' };

    const chunkSize = Math.max(24, Math.ceil(text.length / 24));

    for (let index = 0; index < text.length; index += chunkSize) {
        yield { id, text: text.slice(index, index + chunkSize), type: 'text-delta' };
        await delay(50);
    }

    yield { id, type: 'text-end' };
}

function tallTableReply(marker: string) {
    const rows = Array.from(
        { length: 30 },
        (_, index) => `["Region ${index + 1}","${(1000 + index * 37).toLocaleString('en-US')}"]`
    );

    return [
        `Here is the table.\n${marker}`,
        '',
        '```widget:table',
        `{"columns":["Region","Variance"],"rows":[${rows.join(',')}]}`,
        '```',
    ].join('\n');
}

function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function e2eResponseContent(input: AgentExecutorInput) {
    const exactReply = parseExactReply(input.content);
    if (exactReply) {
        return exactReply;
    }
    const quoted = input.content.trim() || 'your message';
    return `${input.agent.name}: received "${quoted}".`;
}

function parseExactReply(content: string) {
    const quoted = content.match(/reply exactly\s+`([^`]+)`/iu);
    if (quoted?.[1]) {
        return quoted[1];
    }
    const bare = content.match(/reply exactly\s+([A-Z0-9_-]+)/iu);
    return bare?.[1] ?? null;
}
