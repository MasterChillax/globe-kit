import { describe, expect, test } from 'vitest';
import { loadRegistry, resolveStack, rasterDrawnAt } from '../src/index';
import type { Provider } from '../src/index';

const web = { app: 'jarvis', usage: 'personal' as const, exposure: 'private' as const, platform: 'web' as const, consents: [] as string[], keys: () => undefined };
const registry = loadRegistry();
const stack = resolveStack(registry, web);

describe('v0.2.1 — night layer zoom range', () => {
  // Jarvis measured it: at z15 one Black Marble z8 pixel fills the screen at opacity .92 — a white inverted map.
  test('std-night hides from z10 (source z8 + two overzoom levels); overview still hides from z9', () => {
    expect(stack.layers.find((l) => l.id === 'std-night')?.maxzoom).toBe(10);
    expect(stack.layers.find((l) => l.id === 'std-overview')?.maxzoom).toBe(9);
  });
});

describe('v0.2.1 — rasterDrawnAt(layer, zoom)', () => {
  test('true inside [minzoom, maxzoom), false at and past maxzoom, false below minzoom', () => {
    const night = stack.layers.find((l) => l.id === 'std-night')!;
    expect(rasterDrawnAt(night, 0)).toBe(true);
    expect(rasterDrawnAt(night, 9.99)).toBe(true);
    expect(rasterDrawnAt(night, 10)).toBe(false);
    expect(rasterDrawnAt(night, 15)).toBe(false);
    expect(rasterDrawnAt({ minzoom: 7, maxzoom: 19 }, 6.5)).toBe(false);
    expect(rasterDrawnAt({ minzoom: 7, maxzoom: 19 }, 7)).toBe(true);
  });
  test('a layer without zoom bounds is drawn at every zoom', () => {
    expect(rasterDrawnAt({}, 22)).toBe(true);
  });
});

describe('v0.2.1 — customAttribution: only what MapLibre cannot show by itself', () => {
  test('current registry: OFM credits ride in its TileJSON and rasters carry attribution on the source → nothing for customAttribution', () => {
    expect(stack.customAttribution).toEqual([]);
    expect(stack.attribution.length).toBeGreaterThan(2); // the full list is still there for notices
  });
  test('negative control: a vector style without attributionInStyle must be credited by the app', () => {
    const flipped = { ...registry, providers: registry.providers.map((p): Provider => (p.kind === 'vector-style' ? { ...p, attributionInStyle: false } : p)) };
    expect(resolveStack(flipped, web).customAttribution).toEqual(['OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors']);
  });
});
