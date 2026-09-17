import { describe, expect, test } from 'vitest';
import { expression as specExpression, validateStyleMin as specValidateStyle } from '@maplibre/maplibre-gl-style-spec';
import { loadRegistry, resolveBasemapStyleUrl, keysFrom, labelTextField, localizeLabels, seaNameLayerFrom } from '../src/index';

const registry = loadRegistry();
const CARTO = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const keys = keysFrom({ CARTO_API_KEY: 'k-1234567890abcdefghij' });

// Corea C1 adversarial review #2 (#150): the override gate matched hosts exactly, so a subdomain that
// serves the very same CARTO style slipped through as "unknown host" — keyless CARTO + OFM credit.
describe('v0.2.6 — style-URL override: subdomains, normalisation, https, exposure', () => {
  test('a CARTO subdomain is the keyed provider too: refused without the key, accepted with it', () => {
    for (const host of ['tiles.basemaps.cartocdn.com', 'a.basemaps.cartocdn.com']) {
      const url = `https://${host}/gl/dark-matter-gl-style/style.json`;
      expect(() => resolveBasemapStyleUrl(registry, url)).toThrow(/CARTO_API_KEY/);
      expect(resolveBasemapStyleUrl(registry, url, keys)).toBe(url);
    }
  });
  test('the returned URL is normalised: lower-case host, default port dropped', () => {
    expect(resolveBasemapStyleUrl(registry, 'HTTPS://BASEMAPS.CARTOCDN.COM:443/gl/dark-matter-gl-style/style.json', keys)).toBe(CARTO);
  });
  test('only https overrides are accepted', () => {
    expect(() => resolveBasemapStyleUrl(registry, 'http://tiles.example.org/style.json')).toThrow(/https/);
  });
  test('a public app refuses hosts the registry does not know (its privacy policy lists every recipient); a private app may self-host', () => {
    const unknown = 'https://tiles.example.org/self-hosted/style.json';
    expect(() => resolveBasemapStyleUrl(registry, unknown, undefined, { exposure: 'public' })).toThrow(/registry/);
    expect(resolveBasemapStyleUrl(registry, unknown, undefined, { exposure: 'private' })).toBe(unknown);
    expect(resolveBasemapStyleUrl(registry, unknown)).toBe(unknown);
  });
  test('denied hosts are still refused first, whatever the exposure', () => {
    expect(() => resolveBasemapStyleUrl(registry, 'https://server.arcgisonline.com/x/style.json', undefined, { exposure: 'private' })).toThrow(/denied/);
  });
});

// Corea measured Seoul z14: roads 5/391, places 1/203, water names 2/11 have a Korean `name` but no
// name:ko, and the old coalesce showed their romanisation ("Yulgok-ro 5-gil"). Korean first means a
// Hangul `name` outranks name:latin.
describe('v0.2.6 — Korean-first label expression', () => {
  const evaluate = (props: Record<string, string>) => {
    const compiled = specExpression.createExpression(labelTextField(), { type: 'string' } as never);
    expect(compiled.result).toBe('success');
    return (compiled.value as { evaluate: (g: unknown, f: unknown) => unknown }).evaluate({ zoom: 10 }, { type: 'Point', properties: props, geometry: { type: 'Point', coordinates: [0, 0] } });
  };
  test('is a valid MapLibre string expression (official style-spec)', () => {
    expect(specExpression.createExpression(labelTextField(), { type: 'string' } as never).result).toBe('success');
  });
  test('name:ko first, then a Hangul name, then name:latin, then name', () => {
    expect(evaluate({ 'name:ko': '동해', 'name:latin': 'Sea of Japan', name: '日本海 / 동해' })).toBe('동해');
    expect(evaluate({ 'name:latin': 'Yulgok-ro 5-gil', name: '율곡로5길' })).toBe('율곡로5길');
    expect(evaluate({ 'name:latin': 'Tokyo', name: '東京' })).toBe('Tokyo');
    expect(evaluate({ name: 'Paris' })).toBe('Paris');
    expect(evaluate({})).toBe('');
  });
  test('a custom preference without name:latin stays a plain coalesce', () => {
    expect(labelTextField(['name:en', 'name'])).toEqual(['coalesce', ['get', 'name:en'], ['get', 'name']]);
  });
  test('localizeLabels and seaNameLayerFrom carry the same default expression', () => {
    const style = { layers: [{ id: 'place_city', type: 'symbol', layout: { 'text-field': '{name:latin}' } }] };
    expect(localizeLabels(style).layers[0]?.layout?.['text-field']).toEqual(labelTextField());
    const sea = seaNameLayerFrom({ id: 'water_name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name', layout: { 'text-font': ['Noto Sans Italic'] } });
    expect(sea.layout['text-field']).toEqual(labelTextField());
  });
  test('a minimal style carrying the sea-name layer validates against the style-spec', () => {
    const sea = seaNameLayerFrom({ id: 'water_name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name', layout: { 'text-font': ['Noto Sans Italic'], 'text-size': 12 } });
    const style = { version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } }, layers: [sea] };
    const errors = specValidateStyle(style as never) as { message: string }[];
    expect(errors.map((e) => e.message)).toEqual([]);
  });
});
