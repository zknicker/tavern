import { describe, expect, test } from 'vitest';
import { computeBareStatus } from './bare';

const URL = 'http://127.0.0.1:18790';

describe('computeBareStatus', () => {
    test('reachable, versions match → healthy', () => {
        const status = computeBareStatus('1.4.2', '1.4.2', URL);
        expect(status.tone).toBe('healthy');
        expect(status.text).toBe('Runtime v1.4.2 · healthy · http://127.0.0.1:18790');
    });

    test('reachable, binary newer → degraded staged hint', () => {
        const status = computeBareStatus('1.4.0', '1.4.2', URL);
        expect(status.tone).toBe('degraded');
        expect(status.text).toBe("Runtime v1.4.0 · binary v1.4.2 staged — run 'tavern restart'");
    });

    test('unreachable → off', () => {
        const status = computeBareStatus(null, '1.4.2', URL);
        expect(status.tone).toBe('off');
        expect(status.text).toBe("Runtime not running · 'brew services start tavern-runtime'");
    });
});
