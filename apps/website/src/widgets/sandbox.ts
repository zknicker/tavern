/**
 * Opaque-origin sandbox for the artifact-pane page renderer and other
 * agent-authored HTML surfaces. Never add
 * allow-same-origin: the agent-authored document must not reach the app
 * origin's cookies, storage, or DOM.
 */
export const workspaceIframeSandbox =
    'allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts';
