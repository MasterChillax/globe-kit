import { describe, expect, test } from 'vitest';
import { loadRegistry, resolveStack, keysFrom } from '../src/index';

const registry = loadRegistry();
const jarvis = { app: 'jarvis', usage: 'personal' as const, exposure: 'private' as const, platform: 'web' as const, consents: [] as string[] };

// Jarvis (#734/#736): a reserve style that lacks its key is not a missing feature — showing
// "carto-dark-matter: 키 없음" in the diagnostics line would tell the viewer nothing true.
describe('v0.2.3 — fallback providers never appear in dropped[]', () => {
  test('keyless: CARTO is neither in dropped nor in styleFallbacks; the real drops stay', () => {
    const s = resolveStack(registry, { ...jarvis, keys: () => undefined });
    expect(s.dropped.map((d) => d.id)).toEqual(['arcgis-world-imagery', 'vworld-satellite', 'vworld-hybrid']);
    expect(s.styleFallbacks).toEqual([]);
  });

  test('keyed: CARTO shows up in styleFallbacks only', () => {
    const s = resolveStack(registry, { ...jarvis, keys: keysFrom({ CARTO_API_KEY: 'k-1234567890abcdefghij' }) });
    expect(s.dropped.map((d) => d.id)).not.toContain('carto-dark-matter');
    expect(s.styleFallbacks.map((f) => f.id)).toEqual(['carto-dark-matter']);
  });

  test('dropped entries carry kind and role so apps can filter without a lookup table', () => {
    const s = resolveStack(registry, { ...jarvis, keys: () => undefined });
    expect(s.dropped).toContainEqual({ id: 'arcgis-world-imagery', reason: 'missing-key', kind: 'raster', role: 'satellite' });
    expect(s.dropped).toContainEqual({ id: 'vworld-hybrid', reason: 'missing-key', kind: 'raster', role: 'korea-labels' });
  });

  test('negative control: a fallback that fails for a licence reason is still silent, a non-fallback is not', () => {
    const native = resolveStack(registry, { ...jarvis, platform: 'native', keys: () => undefined });
    expect(native.dropped).toContainEqual({ id: 'terrarium-dem', reason: 'platform', kind: 'raster-dem', role: 'terrain' });
    expect(native.dropped.map((d) => d.id)).not.toContain('carto-dark-matter');
  });
});
