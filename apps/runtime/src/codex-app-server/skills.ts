import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import type { AgentRuntimeSkillSummary } from '@tavern/api';

const requestTimeoutMs = 10_000;
const emptyRequirements = {
    anyBins: [],
    bins: [],
    config: [],
    env: [],
    os: [],
};

interface CodexRpcResponse {
    error?: {
        message?: string;
    };
    id?: number;
    result?: unknown;
}

interface CodexSkillRecord {
    description?: unknown;
    enabled?: unknown;
    interface?: {
        displayName?: unknown;
        shortDescription?: unknown;
    };
    name?: unknown;
    path?: unknown;
    scope?: unknown;
}

export async function listCodexAppServerSkills(): Promise<AgentRuntimeSkillSummary[]> {
    const client = new CodexAppServerClient();

    try {
        await client.initialize();
        const result = await client.request('skills/list', {});
        return mapCodexSkillsResult(result);
    } finally {
        client.close();
    }
}

export function mapCodexSkillsResult(result: unknown): AgentRuntimeSkillSummary[] {
    const entries = readRecordArray(result, ['data']);
    const skills = entries.flatMap((entry) => readRecordArray(entry, ['skills']));
    const mapped = skills.flatMap((skill) => {
        const summary = mapCodexSkill(skill);
        return summary ? [summary] : [];
    });

    return dedupeSkills(mapped);
}

function mapCodexSkill(skill: CodexSkillRecord): AgentRuntimeSkillSummary | null {
    const name = readString(skill.name)?.trim();
    if (!name) {
        return null;
    }

    const enabled = skill.enabled !== false;

    return {
        allowedTools: null,
        configChecks: [],
        description: readString(skill.interface?.shortDescription) ?? readString(skill.description),
        disabled: !enabled,
        eligible: enabled,
        filePath: readString(skill.path),
        id: `codex:${name}`,
        install: [],
        missing: emptyRequirements,
        name: readString(skill.interface?.displayName) ?? name,
        requirements: emptyRequirements,
        runtimeSource: 'codex-app-server',
        skillKey: name,
        source: readString(skill.scope) === 'system' ? 'builtin' : 'installed',
        updatedAt: null,
    };
}

export function mergeAgentAndCodexSkills(
    agentSkills: AgentRuntimeSkillSummary[],
    codexSkills: AgentRuntimeSkillSummary[]
) {
    const agentKeys = new Set(agentSkills.flatMap(skillIdentityKeys));
    const codexOnlySkills = codexSkills.filter(
        (skill) => !skillIdentityKeys(skill).some((key) => agentKeys.has(key))
    );

    return dedupeSkills([...agentSkills, ...codexOnlySkills]);
}

function dedupeSkills(skills: AgentRuntimeSkillSummary[]) {
    return [...new Map(skills.map((skill) => [skill.id, skill])).values()].sort((left, right) =>
        left.name.localeCompare(right.name)
    );
}

function skillIdentityKeys(skill: AgentRuntimeSkillSummary) {
    return [
        skill.filePath ? `path:${skill.filePath}` : null,
        skill.skillKey ? `key:${skill.skillKey}` : null,
        `id:${stripCodexSkillPrefix(skill.id)}`,
    ].filter((key): key is string => Boolean(key));
}

function stripCodexSkillPrefix(id: string) {
    return id.startsWith('codex:') ? id.slice('codex:'.length) : id;
}

class CodexAppServerClient {
    readonly #child: ChildProcessWithoutNullStreams;
    readonly #pending = new Map<
        number,
        {
            reject: (error: Error) => void;
            resolve: (response: CodexRpcResponse) => void;
        }
    >();
    #nextId = 1;

    constructor() {
        this.#child = spawn('codex', ['app-server', '--listen', 'stdio://'], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.#child.once('error', (error) => {
            const nextError = error instanceof Error ? error : new Error(String(error));
            for (const pending of this.#pending.values()) {
                pending.reject(nextError);
            }
            this.#pending.clear();
        });
        const lines = createInterface({ input: this.#child.stdout });
        lines.on('line', (line) => this.#handleLine(line));
    }

    async initialize() {
        await this.request('initialize', {
            capabilities: { experimentalApi: true },
            clientInfo: {
                name: 'tavern-runtime',
                title: 'Tavern Runtime',
                version: '0.0.0',
            },
        });
        this.#notify('initialized');
    }

    request(method: string, params: unknown) {
        const id = this.#nextId;
        this.#nextId += 1;
        this.#write({ id, method, params });

        return new Promise<unknown>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.#pending.delete(id);
                reject(new Error(`codex app-server ${method} timed out`));
            }, requestTimeoutMs);

            this.#pending.set(id, {
                reject,
                resolve: (response) => {
                    clearTimeout(timeout);
                    if (response.error) {
                        reject(new Error(response.error.message ?? `${method} failed`));
                        return;
                    }
                    resolve(response.result);
                },
            });
        });
    }

    close() {
        this.#child.stdin.end();
        this.#child.kill('SIGTERM');
    }

    #notify(method: string, params?: unknown) {
        this.#write({ method, params });
    }

    #write(message: unknown) {
        this.#child.stdin.write(`${JSON.stringify(message)}\n`);
    }

    #handleLine(line: string) {
        const trimmed = line.trim();
        if (!trimmed) {
            return;
        }

        const parsed = parseRpcResponse(trimmed);
        if (!parsed?.id) {
            return;
        }

        this.#pending.get(parsed.id)?.resolve(parsed);
        this.#pending.delete(parsed.id);
    }
}

function parseRpcResponse(line: string): CodexRpcResponse | null {
    try {
        const parsed = JSON.parse(line) as CodexRpcResponse;
        return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
        return null;
    }
}

function readRecordArray(value: unknown, path: string[]): Record<string, unknown>[] {
    const resolved = path.reduce<unknown>(
        (current, key) => (isRecord(current) ? current[key] : undefined),
        value
    );
    return Array.isArray(resolved) ? resolved.filter(isRecord) : [];
}

function readString(value: unknown) {
    return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
