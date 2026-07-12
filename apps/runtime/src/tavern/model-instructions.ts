import type { AgentRuntimeModelName } from '@tavern/api';

/**
 * Model-family operational guidance, composed into the system prompt when the
 * session's effective model belongs to a family that needs explicit steering.
 * Claude-family models get none — they act on tools without enforcement.
 * Copy stays tool-agnostic because harness tool names differ per provider.
 *
 * PROMPT CONTRACT: text changes must pass agent-prompt-contract.test.ts and
 * need explicit operator approval. See AGENTS.md ("Agent System Prompt
 * Changes").
 */

// Model name substrings that get tool-use enforcement.
const enforcementFamilies = ['gpt', 'codex', 'gemini', 'gemma', 'grok', 'glm', 'qwen', 'deepseek'];
// Subset that also gets the execution-discipline block.
const disciplineFamilies = ['gpt', 'codex', 'grok'];
// Google models get extra operational directives.
const googleFamilies = ['gemini', 'gemma'];

export function modelOperationalInstructions(
    model: AgentRuntimeModelName,
    options: { wikiEnabled?: boolean } = {}
): string | null {
    const name = model.model.toLowerCase();
    const sections: string[] = [];

    if (enforcementFamilies.some((family) => name.includes(family))) {
        sections.push(toolUseEnforcement);
    }
    if (disciplineFamilies.some((family) => name.includes(family))) {
        sections.push(executionDiscipline(options.wikiEnabled ?? true));
    }
    if (googleFamilies.some((family) => name.includes(family))) {
        sections.push(googleOperationalDirectives);
    }

    return sections.length > 0 ? sections.join('\n\n') : null;
}

const toolUseEnforcement = `## Tool-Use Enforcement

You MUST use your tools to take action — do not describe what you would do without doing it. When you say you will perform an action ("I will check the file", "Let me search Memory"), make the corresponding tool call in the same response. Never end your turn with a promise of future action — execute it now.

Keep working until the task is actually complete. Every response should either contain tool calls that make progress or deliver a final result. Responses that only describe intentions are not acceptable.`;

function executionDiscipline(wikiEnabled: boolean) {
    return `## Execution Discipline

Tool persistence:
- Use tools whenever they improve correctness, completeness, or grounding.
- If a tool returns empty or partial results, retry with a different query or strategy before giving up.
- Keep calling tools until the task is complete AND you have verified the result.

Never answer these from memory — always use a tool:
- Arithmetic, hashes, encodings, current time or dates → your shell.
- File contents, sizes, structure → your file tools.
- Older chat messages → the chat tools.${wikiEnabled ? '\n- Durable shared knowledge the user references → wiki_search.' : ''}
- Your core memory files describe the user, not the machine you run on.

Act on the obvious interpretation instead of asking ("what time is it?" → run it). Ask for clarification only when the ambiguity changes which tool you would call. If required context is missing and retrievable, retrieve it; if you must proceed without it, label assumptions explicitly.

Before finalizing: does the output satisfy every stated requirement, are factual claims backed by tool outputs, and does the format match what was asked?`;
}

const googleOperationalDirectives = `## Operational Directives

- Use absolute file paths for all file operations.
- Verify file contents and structure before changing them; never guess.
- Never assume a library is available — check the project's dependency manifest first.
- Keep explanatory text brief; focus on actions and results over narration.
- Use non-interactive flags (-y, --yes) so commands never hang on prompts.
- Work autonomously until the task is fully resolved. Don't stop with a plan — execute it.`;
