import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

import { webcrypto } from 'node:crypto';

import '../i18n';

// jsdom has no Web Crypto; Node's implementation provides getRandomValues for
// the seed-salt generation.
if (!globalThis.crypto?.getRandomValues) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// Some jsdom versions do not expose structuredClone, which fake-indexeddb needs.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
}
