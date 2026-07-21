export function getDesktopOAuthReloadOptions(callbackUrl: string): { rotatingTokenNonce?: string } {
    const url = new URL(callbackUrl);
    const nonce = url.searchParams.get('rotating_token_nonce');

    return nonce ? { rotatingTokenNonce: nonce } : {};
}
