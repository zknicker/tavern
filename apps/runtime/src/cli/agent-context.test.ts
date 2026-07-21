import { describe, expect, test } from 'vitest';
import { resolveAgentContext } from './agent-context.ts';
import { AgentCliError } from './agent-error.ts';

const token = `grta_${'a'.repeat(43)}`;
const complete = {
    GROTTO_AGENT_ID: 'agt_wren',
    GROTTO_AGENT_TOKEN_FILE: '/tmp/wren-token',
    GROTTO_SERVER_URL: 'http://127.0.0.1:18790',
};

describe('resolveAgentContext', () => {
    test.each([
        [{ ...complete, GROTTO_AGENT_ID: undefined }, 'MISSING_AGENT_ID'],
        [{ ...complete, GROTTO_SERVER_URL: undefined }, 'MISSING_SERVER_URL'],
        [{ ...complete, GROTTO_AGENT_TOKEN_FILE: undefined }, 'MISSING_TOKEN'],
    ])('fails closed for missing bootstrap env', (environment, code) => {
        expectAgentError(() => resolveAgentContext(environment, () => token), code);
    });

    test('reports unreadable token files', () => {
        expectAgentError(
            () =>
                resolveAgentContext(complete, () => {
                    throw new Error('EACCES');
                }),
            'TOKEN_FILE_UNREADABLE'
        );
    });

    test('reports empty token files', () => {
        expectAgentError(() => resolveAgentContext(complete, () => ' \n'), 'TOKEN_FILE_EMPTY');
    });

    test('rejects non-agent token shapes without a fallback', () => {
        expectAgentError(
            () => resolveAgentContext(complete, () => 'runtime-token'),
            'MISSING_TOKEN'
        );
    });

    test('accepts opaque agent ids but rejects path-unsafe ones', () => {
        expect(
            resolveAgentContext({ ...complete, GROTTO_AGENT_ID: 'planner' }, () => token).agentId
        ).toBe('planner');
        for (const unsafe of ['../evil', 'a b', '.hidden', 'a/b']) {
            expectAgentError(
                () => resolveAgentContext({ ...complete, GROTTO_AGENT_ID: unsafe }, () => token),
                'MISSING_AGENT_ID'
            );
        }
    });

    test('trims and returns the agent token', () => {
        expect(resolveAgentContext(complete, () => `  ${token}\n`)).toEqual({
            agentId: 'agt_wren',
            serverUrl: 'http://127.0.0.1:18790',
            token,
            tokenFile: '/tmp/wren-token',
        });
    });
});

function expectAgentError(run: () => unknown, code: string): void {
    try {
        run();
        throw new Error('expected failure');
    } catch (error) {
        expect(error).toBeInstanceOf(AgentCliError);
        expect((error as AgentCliError).code).toBe(code);
        expect((error as AgentCliError).options.nextAction).toBeTruthy();
    }
}
