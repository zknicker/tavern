export async function hermesFetchError(response: Response) {
    const text = await response.text().catch(() => '');
    const error = new Error(text || `Hermes request failed with ${response.status}.`) as Error & {
        code?: string;
        status?: number;
    };
    error.code = 'hermes_request_failed';
    error.status = response.status;
    return error;
}

export function managedHermesSetupError(message: string) {
    const error = new Error(message) as Error & { code?: string };
    error.code = 'managed_hermes_setup';
    return error;
}

export function isManagedHermesSetupError(err: unknown): err is Error & { code: string } {
    return err instanceof Error && (err as { code?: string }).code === 'managed_hermes_setup';
}

export function unsupportedHermesSurface(message: string): never {
    const error = new Error(`${message} is not supported by the agent engine yet.`) as Error & {
        code?: string;
    };
    error.code = 'unsupported_hermes_surface';
    throw error;
}
