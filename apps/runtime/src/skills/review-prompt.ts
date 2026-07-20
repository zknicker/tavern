import { listRuntimeSkills } from '../agent-engine/skill-library.ts';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import {
    type LearningSignal,
    type MemoryExtractionMessage,
    memoryExtractionChunkChars,
    renderExtractionTranscript,
} from '../memory/extraction-worker.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';

interface SkillReviewPromptInput {
    agentId: string;
    chatId: string;
    signals: LearningSignal[];
    windowEndSequence: number | null;
    windowStartSequence: number | null;
}

export const skillReviewInstructions = `You are the background skill review worker for a Grotto agent. A settled
chat window produced learning signals. Decide what the skill library should
learn from it, make the smallest durable update, and stop.

The library's target shape is class-level skills: one skill per class of
work, with a rich SKILL.md and references/, templates/, or scripts/ files
carrying session-specific detail. Not one narrow skill per session.

Update ladder — take the earliest step that fits:
1. Patch a skill that was in play in this window.
2. Patch an existing class-level skill that covers the territory.
3. Add a references/, templates/, or scripts/ file under an existing skill,
   and add a one-line pointer to it in that skill's SKILL.md.
4. Create a new class-level skill. The name must describe a class of work;
   if it only makes sense for today's task, fall back to steps 1-3.

User preference corrections belong embedded in the governing skill's body,
phrased as how to do the work — not as a log of what went wrong.

Never capture:
- environment-dependent failures (missing binaries, unconfigured
  credentials, fresh-install errors); if there is a setup skill, capture
  the fix there
- negative claims about tools or features ("X is broken", "cannot use Y")
- transient errors that already resolved; if a retry worked, the lesson is
  the retry pattern
- one-off task narratives

Use skills_list and skill_view before writing. Make at most a few focused
updates. If the signals do not justify a durable change, reply exactly
"Nothing to change." and stop. Finish with one short line per action taken.`;

export async function buildSkillReviewPrompt(
    input: SkillReviewPromptInput,
    options: { skillsDir?: string } = {}
) {
    return [
        'Learning signals:',
        input.signals.map(renderSignal).join('\n') || 'NONE',
        '',
        'Enabled skills:',
        (await listEnabledSkills(input.agentId, options))
            .map((skill) => `- ${skill.id}: ${skill.name}`)
            .join('\n') || 'NONE',
        '',
        'Transcript window:',
        '',
        renderExtractionTranscript(readReviewMessages(input)),
    ].join('\n');
}

function readReviewMessages(input: SkillReviewPromptInput) {
    const start = input.windowStartSequence ?? 0;
    const end = input.windowEndSequence ?? Number.MAX_SAFE_INTEGER;
    const rows = getDb()
        .prepare(
            `SELECT id, sequence, author_id, role, content, created_at
             FROM chat_messages
             WHERE chat_id = $chatId
               AND sequence >= $start
               AND sequence <= $end
               AND deleted_at IS NULL
               AND role IN ('user', 'assistant')
               AND trim(content) != ''
             ORDER BY sequence ASC`
        )
        .all(namedParams({ chatId: input.chatId, end, start })) as MemoryExtractionMessage[];
    return capNewestMessages(rows);
}

function capNewestMessages(messages: MemoryExtractionMessage[]) {
    const kept: MemoryExtractionMessage[] = [];
    let chars = 0;
    for (const message of [...messages].reverse()) {
        if (kept.length > 0 && chars + message.content.length > memoryExtractionChunkChars) {
            break;
        }
        kept.push(message);
        chars += message.content.length;
    }
    return kept.reverse();
}

async function listEnabledSkills(agentId: string, options: { skillsDir?: string }) {
    const agent = getStoredAgent(agentId);
    if (!agent) {
        throw new Error(`Agent "${agentId}" does not exist.`);
    }
    const enabled = new Set(agent.enabledSkillIds);
    return (
        await listRuntimeSkills({
            agent,
            includePluginSkills: false,
            skillsDir: options.skillsDir,
        })
    )
        .filter((skill) => enabled.has(skill.id))
        .map((skill) => ({
            id: skill.id,
            name: skill.name,
        }));
}

function renderSignal(signal: LearningSignal) {
    const prefix =
        signal.kind === 'skill_misfire' && signal.skillId
            ? `skill_misfire[${signal.skillId}]`
            : signal.kind;
    return `- ${prefix}: ${signal.detail}`;
}
