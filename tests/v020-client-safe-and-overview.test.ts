import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry, resolveStack, keysFrom } from '../src/index';
import type { Provider } from '../src/index';
import { loadRegistryFile } from '../src/node';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY_FILE = resolve(HERE, '..', 'registry', 'providers.json');
const web = { app: 'jarvis', usage: 'personal' as const, exposure: 'private' as const, platform: 'web' as const, consents: [] as string[] };
const noKeys = () => undefined;

describe('v0.2.0 — client-safe registry', () => {
  test('loadRegistry() (bundled JSON, no fs) equals the registry file on disk', () => {
    expect(loadRegistry()).toEqual(loadRegistryFile(REGISTRY_FILE));
    expect(loadRegistry()).toEqual(JSON.parse(readFileSync(REGISTRY_FILE, 'utf8')));
  });
});

describe('v0.2.0 — keysFrom (explicit key map for client bundles)', () => {
  test('returns the value for a known name; undefined for missing, empty or blank', () => {
    const keys = keysFrom({ ARCGIS_API_KEY: 'abc', VWORLD_KEY: '', OTHER: '   ', ABSENT: undefined });
    expect(keys('ARCGIS_API_KEY')).toBe('abc');
    expect(keys('VWORLD_KEY')).toBeUndefined();
    expect(keys('OTHER')).toBeUndefined();
    expect(keys('ABSENT')).toBeUndefined();
    expect(keys('NOPE')).toBeUndefined();
  });
  test('an explicit map gates the stack exactly like a lookup function', () => {
    const registry = loadRegistry();
    const key = 'k-1234567890abcdefghij';
    const a = resolveStack(registry, { ...web, keys: keysFrom({ ARCGIS_API_KEY: key }) });
    const b = resolveStack(registry, { ...web, keys: (n) => (n === 'ARCGIS_API_KEY' ? key : undefined) });
    expect(a).toEqual(b);
    expect(a.layers.map((l) => l.id)).toContain('std-satellite');
  });
});

describe('v0.2.0 — overview layer zoom range', () => {
  test('std-overview hides from z9 (source ends at z8; one overzoom level allowed) — night glows two levels further (v0.2.1: hidden from z10)', () => {
    const stack = resolveStack(loadRegistry(), { ...web, keys: noKeys });
    const overview = stack.layers.find((l) => l.id === 'std-overview');
    const night = stack.layers.find((l) => l.id === 'std-night');
    expect(overview?.maxzoom).toBe(9);
    expect(night?.maxzoom).toBe(10);
  });
  test('negative control: a provider without layerMaxzoom emits no layer maxzoom', () => {
    const registry = loadRegistry();
    const without = (p: Provider) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'layerMaxzoom')) as Provider;
    const stripped = { ...registry, providers: registry.providers.map((p) => (p.id === 'gibs-bluemarble' ? without(p) : p)) };
    const s = resolveStack(stripped, { ...web, keys: noKeys });
    expect(s.layers.find((l) => l.id === 'std-overview')?.maxzoom).toBeUndefined();
  });
});
