import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getApiConfig } from './config.js';

const KEYS = [
  'API_BASE_URL', 'K2046_API_BASE_URL', 'X_AUTH_TOKEN', 'K2046_X_AUTH_TOKEN',
  'K2046_AUTH_TOKEN', 'COOKIE', 'K2046_COOKIE',
];
const saved = new Map(KEYS.map(key => [key, process.env[key]]));

function setEnv(values: Record<string, string>): void {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('K2046_AUTH_TOKEN 作为令牌别名被识别', () => {
  setEnv({ API_BASE_URL: 'https://k2046.test', K2046_AUTH_TOKEN: 'legacy-token' });
  assert.equal(getApiConfig().authToken, 'legacy-token');
});

test('X_AUTH_TOKEN 优先于 K2046_AUTH_TOKEN', () => {
  setEnv({ X_AUTH_TOKEN: 'primary', K2046_AUTH_TOKEN: 'legacy-token' });
  assert.equal(getApiConfig().authToken, 'primary');
});
