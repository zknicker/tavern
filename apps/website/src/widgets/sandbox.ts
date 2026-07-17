/**
 * Opaque-origin sandbox shared by the workspace-file surfaces (the
 * html-preview widget and the artifact-pane page renderer), matching the
 * artifact pane's HTML preview. Never add
 * allow-same-origin: the agent-authored document must not reach the app
 * origin's cookies, storage, or DOM.
 */
export const workspaceIframeSandbox =
    'allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts';
