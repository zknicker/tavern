export async function agentEngineFetchError(response: Response) {
    const text = await response.text().catch(() => '');
    const error = new Error(
        text || `Agent engine request failed with ${response.status}.`
    ) as Error & {
        code?: string;
        status?: number;
    };
    error.code = 'agent_engine_request_failed';
    error.status = response.status;
    return error;
}

export function managedAgentEngineSetupError(message: string) {
    const error = new Error(message) as Error & { code?: string };
    error.code = 'managed_agent_engine_setup';
    return error;
}

export function isManagedAgentEngineSetupError(err: unknown): err is Error & { code: string } {
    return err instanceof Error && (err as { code?: string }).code === 'managed_agent_engine_setup';
}

export function unsupportedAgentEngineSurface(message: string): never {
    const error = new Error(`${message} is not supported by the agent engine yet.`) as Error & {
        code?: string;
    };
    error.code = 'unsupported_agent_engine_surface';
    throw error;
}
