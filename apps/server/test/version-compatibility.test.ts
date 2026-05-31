import { describe, expect, test } from 'bun:test';
import {
    getRuntimeVersionStatus,
    isCompatibleRuntimeVersion,
} from '../src/agent-runtime-connection/version-compatibility.ts';

describe('Runtime version compatibility', () => {
    test('accepts patch releases in the required Runtime API epoch', () => {
        expect(
            isCompatibleRuntimeVersion({
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.1.11',
            })
        ).toBe(true);
        expect(
            isCompatibleRuntimeVersion({
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.1.19',
            })
        ).toBe(true);
    });

    test('rejects older or different Runtime API epochs', () => {
        expect(
            isCompatibleRuntimeVersion({
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.1.10',
            })
        ).toBe(false);
        expect(
            isCompatibleRuntimeVersion({
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.2.0',
            })
        ).toBe(false);
    });

    test('distinguishes exact match from compatible skew', () => {
        expect(
            getRuntimeVersionStatus({
                appVersion: '1.1.12',
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.1.12',
            })
        ).toBe('matched');
        expect(
            getRuntimeVersionStatus({
                appVersion: '1.1.12',
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.1.11',
            })
        ).toBe('compatible');
    });
});
