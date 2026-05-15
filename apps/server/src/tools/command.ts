function basename(value: string) {
    const normalized = value.replace(/\/+$/u, '');
    const segments = normalized.split('/');
    return segments.at(-1) ?? normalized;
}

export function formatFilePathSummary(filePath: string | null) {
    if (!filePath) {
        return null;
    }

    const normalized = filePath.replace(/\/+$/u, '').trim();

    if (normalized.length === 0) {
        return null;
    }

    const workspaceMatch = /\/workspace\/[^/]+\/(.+)$/u.exec(normalized);

    if (workspaceMatch?.[1]) {
        return workspaceMatch[1];
    }

    const segments = normalized.split('/').filter(Boolean);

    if (segments.length >= 2) {
        return segments.slice(-2).join('/');
    }

    return basename(normalized);
}

export function formatUrlHost(url: string | null) {
    if (!url) {
        return null;
    }

    try {
        return new URL(url).host;
    } catch {
        return null;
    }
}

function stripShellQuotes(token: string) {
    return token.replace(/^['"`]+|['"`]+$/gu, '');
}

function isEnvAssignment(token: string) {
    return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function isRedirectionToken(token: string) {
    return /^(?:\d*>>?&?\d*|\d*&>\d*|[<>].*)$/u.test(token);
}

function tokenizeShell(command: string) {
    const tokens = command.match(/"[^"]*"|'[^']*'|`[^`]*`|[^\s]+/g) ?? [];
    return tokens.map((token) => stripShellQuotes(token.trim())).filter(Boolean);
}

function looksLikePath(token: string) {
    return token.startsWith('/') || token.startsWith('./') || token.startsWith('../');
}

function looksLikeUrl(token: string) {
    return /^https?:\/\//u.test(token);
}

function findPrimaryShellTarget(executable: string, tokens: string[]) {
    const args = tokens.slice(1).filter((token) => !token.startsWith('-'));

    if (['node', 'bun', 'python', 'python3', 'bash', 'sh', 'zsh'].includes(executable)) {
        const scriptPath = args.find((token) => looksLikePath(token));
        return scriptPath ? basename(scriptPath) : null;
    }

    if (executable === 'curl') {
        const url = args.find((token) => looksLikeUrl(token));

        if (!url) {
            return null;
        }

        try {
            return new URL(url).host;
        } catch {
            return null;
        }
    }

    const pathToken = [...args].reverse().find((token) => looksLikePath(token));
    return pathToken ? basename(pathToken) : null;
}

export function summarizeCommand(command: string | null) {
    if (!command) {
        return [];
    }

    const segments = command
        .split(/\s*(?:\|\||&&|[;\n])\s*/u)
        .map((segment) => segment.trim())
        .filter(Boolean);
    let tokens: string[] = [];

    for (const segment of segments) {
        if (/^[A-Za-z_][A-Za-z0-9_]*=\$\(/u.test(segment)) {
            continue;
        }

        tokens = tokenizeShell(segment)
            .filter((token) => !isEnvAssignment(token))
            .filter((token) => !isRedirectionToken(token));

        if (tokens.length > 0) {
            break;
        }
    }

    if (tokens.length === 0) {
        return [];
    }

    const executable = basename(tokens[0] ?? '').toLowerCase();
    const displayExecutable = basename(tokens[0] ?? '');
    const target = findPrimaryShellTarget(executable, tokens);

    return [displayExecutable || null, target].filter((value): value is string => Boolean(value));
}

export function deriveProcessState(resultText: string | null) {
    if (!resultText) {
        return null;
    }

    if (resultText.startsWith('No session found')) {
        return 'not found';
    }

    if (resultText.includes('still running')) {
        return 'running';
    }

    if (resultText.includes('Process exited with code')) {
        return 'exited';
    }

    return null;
}
