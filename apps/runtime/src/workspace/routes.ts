import { getDb } from '../db/connection';
import { json } from '../tavern/http';
import {
    readRenderedAgentInstructions,
    renderAgentInstructions,
    updateAgentInstructionSource,
} from './instructions';

export async function handleWorkspaceRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (segments[0] !== 'workspace' || segments[1] !== 'agents' || !segments[2]) {
        return null;
    }

    const agentId = segments[2];

    if (request.method === 'GET' && segments[3] === 'instructions') {
        const rendered = await readRenderedAgentInstructions(getDb(), agentId);
        return json(rendered);
    }

    if (request.method === 'PUT' && segments[3] === 'instructions') {
        const body = await readJson(request);
        const source = updateAgentInstructionSource(getDb(), {
            agentId,
            agentName: readOptionalString(body.agentName),
            workspaceDir: readString(body.workspaceDir, 'workspaceDir'),
        });
        const rendered = await renderAgentInstructions(getDb(), agentId);

        return json({
            agentId: source.agentId,
            renderedAt: rendered.renderedAt,
            sha256: rendered.sha256,
            updatedAt: source.updatedAt,
        });
    }

    return null;
}

async function readJson(request: Request) {
    const body = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

function readString(value: unknown, label: string) {
    const text = readOptionalString(value);
    if (!text) {
        throw new Error(`${label} is required.`);
    }
    return text;
}

function readOptionalString(value: unknown) {
    return typeof value === 'string' ? value.trim() : null;
}
