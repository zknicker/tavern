import os from 'node:os';
import path from 'node:path';

export function resolveE2eOpenClawInstallRoot() {
    return path.join(os.homedir(), '.tavern', 'runtime', 'openclaw', 'versions');
}
