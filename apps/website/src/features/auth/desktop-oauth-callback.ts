export function parseRotatingTokenNonce(callbackUrl: string): string {
    const url = new URL(callbackUrl);
    const nonce = url.searchParams.get('rotating_token_nonce');

    if (!nonce) {
        throw new Error('The sign-in callback did not include a rotating token nonce.');
    }

    return nonce;
}
