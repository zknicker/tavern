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

export function unsupportedHermesSurface(message: string): never {
    const error = new Error(`${message} is not supported by the Hermes adapter yet.`) as Error & {
        code?: string;
    };
    error.code = 'unsupported_hermes_surface';
    throw error;
}
