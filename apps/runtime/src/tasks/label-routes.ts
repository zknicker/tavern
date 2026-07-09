import {
    agentRuntimeCreateTaskLabelSchema,
    agentRuntimeRoutes,
    agentRuntimeTaskLabelListSchema,
    agentRuntimeTaskLabelSchema,
    agentRuntimeUpdateTaskLabelSchema,
} from '@tavern/api';
import { badRequest, json, notFound, readJson } from '../tavern/http.ts';
import { publishLabelDeleted, publishLabelUpdated } from './events.ts';
import { createLabel, deleteLabel, listLabels, updateLabel } from './labels.ts';

export function handleTaskLabelsRequest(
    request: Request
): Promise<Response | null> | Response | null {
    const url = new URL(request.url);
    const method = request.method;
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (segments[0] !== 'labels') {
        return null;
    }

    return respondToTaskLabelsRequest({ method, request, segments, url });
}

async function respondToTaskLabelsRequest(input: {
    method: string;
    request: Request;
    segments: string[];
    url: URL;
}): Promise<Response | null> {
    const { method, request, segments, url } = input;

    try {
        if (method === 'GET' && url.pathname === agentRuntimeRoutes.labels) {
            return json(agentRuntimeTaskLabelListSchema.parse({ labels: listLabels() }));
        }
        if (method === 'POST' && url.pathname === agentRuntimeRoutes.labels) {
            const label = createLabel(
                agentRuntimeCreateTaskLabelSchema.parse(await readJson(request))
            );
            publishLabelUpdated(label.id);
            return json(agentRuntimeTaskLabelSchema.parse(label), 201);
        }
        if (!segments[1] || segments[2]) {
            return null;
        }

        const labelId = segments[1];
        if (method === 'PATCH') {
            const label = updateLabel(
                labelId,
                agentRuntimeUpdateTaskLabelSchema.parse(await readJson(request))
            );
            if (!label) {
                return notFound();
            }
            publishLabelUpdated(label.id);
            return json(agentRuntimeTaskLabelSchema.parse(label));
        }
        if (method === 'DELETE') {
            const deleted = deleteLabel(labelId);
            if (!deleted) {
                return notFound();
            }
            publishLabelDeleted(labelId);
            return json({ deleted: true, id: labelId });
        }
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }

    return null;
}
