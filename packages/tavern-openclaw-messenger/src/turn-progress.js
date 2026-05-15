export function createTurnProgressBroadcaster(context, turnEvent) {
    const seen = new Map();

    return (input) => {
        const id = normalizeProgressId(input.id ?? input.label);

        if (!(id && input.label)) {
            return;
        }

        const step = {
            detail: normalizeProgressText(input.detail),
            id,
            kind: input.kind,
            label: normalizeProgressText(input.label) ?? input.kind,
            status: input.status ?? 'active',
        };
        const fingerprint = JSON.stringify(step);

        if (seen.get(id) === fingerprint) {
            return;
        }

        seen.set(id, fingerprint);
        context.broadcast(
            'plugin.tavern.turn.progress',
            {
                ...turnEvent,
                step,
                timestamp: new Date().toISOString(),
            },
            { dropIfSlow: true }
        );
    };
}

function normalizeProgressId(value) {
    return normalizeProgressText(value)?.slice(0, 160);
}

function normalizeProgressText(value) {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim().replaceAll(/\s+/g, ' ');

    return normalized.length > 0 ? normalized : undefined;
}
