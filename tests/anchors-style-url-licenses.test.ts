import { describe, it, expect } from 'vitest';
import { firstSymbolLayerId, insertUnderLabels } from '../src/anchors';
import { resolveBasemapStyleUrl } from '../src/style-url';
import { loadRegistry } from '../src/index';
import { buildNotices } from '../src/licenses';
import { resolveStack } from '../src/resolve-stack';

describe('anchors — under-labels insertion', () => {
  const layers = [
    { id: 'background', type: 'background' },
    { id: 'water', type: 'fill' },
    { id: 'road', type: 'line' },
    { id: 'water_name', type: 'symbol' },
    { id: 'place_city', type: 'symbol' },
  ];
  it('returns the FIRST symbol layer id so every label stays above the raster', () => {
    expect(firstSymbolLayerId(layers)).toBe('water_name');
  });
  it('negative control — picking the last symbol would bury water_name under the raster', () => {
    expect(firstSymbolLayerId(layers)).not.toBe('place_city');
  });
  it('returns null when there is no symbol layer (caller appends on top)', () => {
    expect(firstSymbolLayerId([{ id: 'background', type: 'background' }])).toBeNull();
    expect(firstSymbolLayerId([])).toBeNull();
  });
  it('insertUnderLabels places new layers right before the first symbol, preserving their order', () => {
    const out = insertUnderLabels(layers, [{ id: 'std-overview', type: 'raster' }, { id: 'std-satellite', type: 'raster' }]);
    const ids = out.map((l) => l.id);
    expect(ids).toEqual(['background', 'water', 'road', 'std-overview', 'std-satellite', 'water_name', 'place_city']);
  });
});

describe('style-url — provider switch', () => {
  const registry = loadRegistry();
  it('empty/blank override falls back to the registry default (OpenFreeMap, not CARTO)', () => {
    for (const v of [undefined, '', '   ']) expect(resolveBasemapStyleUrl(registry, v)).toBe('https://tiles.openfreemap.org/styles/dark');
    expect(resolveBasemapStyleUrl(registry, undefined)).not.toMatch(/cartocdn/);
  });
  it('a real override is used verbatim after trimming', () => {
    expect(resolveBasemapStyleUrl(registry, ' https://example.test/style.json ')).toBe('https://example.test/style.json');
  });
  it('an override pointing at a denied host is refused (throws) so a bad env cannot smuggle keyless Esri back', () => {
    expect(() => resolveBasemapStyleUrl(registry, 'https://server.arcgisonline.com/gl/style.json')).toThrow(/denied/);
  });
  it('an override onto CARTO (keyed fallback since v0.2.2) is refused without CARTO_API_KEY', () => {
    expect(() => resolveBasemapStyleUrl(registry, 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json')).toThrow(/CARTO_API_KEY/);
  });
});

describe('licenses — THIRD_PARTY_NOTICES generation', () => {
  const registry = loadRegistry();
  it('lists exactly the included providers with name, url and attribution; dropped ones are absent', () => {
    const stack = resolveStack(registry, { app: 'jarvis', usage: 'personal', exposure: 'private', platform: 'web', keys: () => undefined, consents: [] });
    const text = buildNotices(registry, stack);
    expect(text).toMatch(/OpenFreeMap/);
    expect(text).toMatch(/NASA GIBS/);
    expect(text).not.toMatch(/Esri/);
    expect(text).not.toMatch(/VWorld/);
  });
});
