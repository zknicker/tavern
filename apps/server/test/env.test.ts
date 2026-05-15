import assert from 'node:assert/strict';
import os from 'node:os';
import test from 'node:test';
import {
    getDefaultAppOrigin,
    getDefaultDatabasePath,
    getDefaultServerPort,
} from '../src/config/env.ts';

test('getDefaultAppOrigin uses the Tavern website port when present', () => {
    const previousPort = process.env.TAVERN_WEBSITE_PORT;

    process.env.TAVERN_WEBSITE_PORT = '4242';

    try {
        assert.equal(getDefaultAppOrigin(), 'http://localhost:4242');
    } finally {
        restoreEnvironmentVariable('TAVERN_WEBSITE_PORT', previousPort);
    }
});

test('getDefaultAppOrigin falls back to the standard website port', () => {
    const previousPort = process.env.TAVERN_WEBSITE_PORT;

    process.env.TAVERN_WEBSITE_PORT = undefined;

    try {
        assert.equal(getDefaultAppOrigin(), 'http://localhost:3100');
    } finally {
        restoreEnvironmentVariable('TAVERN_WEBSITE_PORT', previousPort);
    }
});

test('getDefaultAppOrigin ignores an invalid website port override', () => {
    const previousPort = process.env.TAVERN_WEBSITE_PORT;

    process.env.TAVERN_WEBSITE_PORT = 'nope';

    try {
        assert.equal(getDefaultAppOrigin(), 'http://localhost:3100');
    } finally {
        restoreEnvironmentVariable('TAVERN_WEBSITE_PORT', previousPort);
    }
});

test('getDefaultServerPort uses the Tavern backend port when present', () => {
    const previousPort = process.env.TAVERN_SERVER_PORT;

    process.env.TAVERN_SERVER_PORT = '4243';

    try {
        assert.equal(getDefaultServerPort(), 4243);
    } finally {
        restoreEnvironmentVariable('TAVERN_SERVER_PORT', previousPort);
    }
});

test('getDefaultServerPort falls back to the standard backend port', () => {
    const previousPort = process.env.TAVERN_SERVER_PORT;

    process.env.TAVERN_SERVER_PORT = undefined;

    try {
        assert.equal(getDefaultServerPort(), 8080);
    } finally {
        restoreEnvironmentVariable('TAVERN_SERVER_PORT', previousPort);
    }
});

test('getDefaultServerPort ignores an invalid backend port override', () => {
    const previousPort = process.env.TAVERN_SERVER_PORT;

    process.env.TAVERN_SERVER_PORT = 'oops';

    try {
        assert.equal(getDefaultServerPort(), 8080);
    } finally {
        restoreEnvironmentVariable('TAVERN_SERVER_PORT', previousPort);
    }
});

test('getDefaultDatabasePath uses a temp database during tests', () => {
    const previousNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'test';

    try {
        assert.equal(getDefaultDatabasePath().startsWith(os.tmpdir()), true);
        assert.equal(getDefaultDatabasePath().includes('tavern-tests'), true);
    } finally {
        restoreEnvironmentVariable('NODE_ENV', previousNodeEnv);
    }
});

function restoreEnvironmentVariable(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }

    process.env[key] = value;
}
