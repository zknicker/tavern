// Registry decoupling busy delivery from the turn runner: the runner
// registers a delivery function bound to its current executor, and message
// fan-out calls it without importing the runner (which imports the executor
// stack, which imports the freshness gate, which feeds off busy delivery).

type TurnDelivery = (runId: string, text: string) => Promise<boolean> | boolean;

let delivery: TurnDelivery | null = null;

export function registerTurnDelivery(next: TurnDelivery | null) {
    delivery = next;
}

/**
 * Attempt busy delivery of text into a running turn's engine session.
 * False means not running or unsupported — never an error; the durable
 * message reaches the seat through its context cursor instead.
 */
export async function deliverToActiveTurn(runId: string, text: string): Promise<boolean> {
    try {
        return Boolean(await delivery?.(runId, text));
    } catch {
        return false;
    }
}
