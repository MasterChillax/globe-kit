import { describe, expect, test } from 'vitest';
import {
  loadRegistry, resolveStack, resolveBasemapStyleUrl, keysFrom, deniedReason,
  labelTextField, localizeLabels, seaNameLayerFrom, LABEL_PREFERENCE,
} from '../src/index';

const registry = loadRegistry();
const corea = { app: 'corea', usage: 'commercial' as const, exposure: 'public' as const, platform: 'web' as const, consents: [] as string[] };
const CARTO_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Owner decision 2026-09-17: labels are Korean first on every locale (동해, never "Sea of Japan").
describe('v0.2.2 — label localisation (Korean-first policy)', () => {
  test('labelTextField() prefers name:ko, then a Hangul name, then name:latin, then name (v0.2.6); a custom preference is a plain coalesce', () => {
    expect(LABEL_PREFERENCE).toEqual(['name:ko', 'name:latin', 'name']);
    const field = labelTextField();
    expect(field[0]).toBe('case');
    expect(JSON.stringify(field)).toContain('"name:ko"');
    expect(JSON.stringify(field).indexOf('"name:latin"')).toBeGreaterThan(JSON.stringify(field).indexOf('"가"'));
    expect(labelTextField(['name:en', 'name'])).toEqual(['coalesce', ['get', 'name:en'], ['get', 'name']]);
  });

  test('localizeLabels rewrites every symbol text-field, leaves other layers alone and does not mutate the input', () => {
    const style = {
      version: 8,
      layers: [
        { id: 'water', type: 'fill', paint: { 'fill-color': '#000' } },
        { id: 'place_city', type: 'symbol', layout: { 'text-field': '{name:latin}\n{name:nonlatin}', 'text-font': ['Noto Sans Regular'] } },
        { id: 'icon_only', type: 'symbol', layout: { 'icon-image': 'x' } },
      ],
    };
    const before = JSON.stringify(style);
    const out = localizeLabels(style);
    expect(JSON.stringify(style)).toBe(before);
    expect(out.layers[0]).toEqual(style.layers[0]);
    expect(out.layers[1]?.layout).toEqual({ 'text-field': labelTextField(), 'text-font': ['Noto Sans Regular'] });
    expect(out.layers[2]).toEqual(style.layers[2]);
  });

  // OpenFreeMap dark draws only LineString water names (rivers); the sea points — 동해 at z5–6, name:ko present —
  // are in the tiles but unstyled. The standard adds one point layer cloned from the style's own water_name layer.
  test('seaNameLayerFrom clones the water_name layer into a Point layer with Korean-first labels', () => {
    const template = {
      id: 'water_name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name',
      filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
      layout: { 'text-field': '{name:latin}', 'text-font': ['Noto Sans Italic'], 'symbol-placement': 'line', 'text-size': 12 },
      paint: { 'text-color': 'rgba(120,150,170,1)', 'text-halo-color': '#000' },
    };
    const layer = seaNameLayerFrom(template);
    expect(layer.id).toBe('std-water-name-point');
    expect(layer.type).toBe('symbol');
    expect(layer.source).toBe('openmaptiles');
    expect(layer['source-layer']).toBe('water_name');
    expect(layer.filter).toEqual(['==', ['geometry-type'], 'Point']);
    expect(layer.minzoom).toBe(3);
    expect(layer.layout['text-field']).toEqual(labelTextField());
    expect(layer.layout['symbol-placement']).toBe('point');
    expect(layer.layout['text-font']).toEqual(['Noto Sans Italic']);
    expect(layer.paint).not.toEqual(template.paint); // v0.2.5: the template paint is river ink, unreadable on dark water
    expect(template.filter[2]).toEqual(['LineString', 'MultiLineString']); // template untouched
  });

  test('seaNameLayerFrom refuses a non-symbol template', () => {
    expect(() => seaNameLayerFrom({ id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', layout: {} })).toThrow(/symbol/);
  });

  test('registry 동해 fixture points at the source feature (z5, water_name), 독도 at the village label', () => {
    const donghae = registry.korea.labelFixtures.find((f) => f.name === '동해');
    const dokdo = registry.korea.labelFixtures.find((f) => f.name === '독도');
    expect(donghae).toMatchObject({ zoom: 5, expect: '동해', sourceLayer: 'water_name' });
    expect(dokdo).toMatchObject({ zoom: 9, expect: '독도리' });
  });
});

// Owner decision 2026-09-17: the CARTO key stays as corea's fallback; OpenFreeMap remains the default everywhere.
describe('v0.2.2 — CARTO as a keyed fallback style, not a denied host', () => {
  test('basemaps.cartocdn.com is a registered keyed provider now; keyless Esri stays denied', () => {
    expect(deniedReason(registry, CARTO_STYLE)).toBeNull();
    expect(deniedReason(registry, 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/1/1/1')).not.toBeNull();
    const carto = registry.providers.find((p) => p.id === 'carto-dark-matter');
    expect(carto).toMatchObject({ kind: 'vector-style', role: 'basemap', fallback: true, keyRequired: 'CARTO_API_KEY', keyPlacement: 'request', cacheable: false });
  });

  test('without a CARTO key: OpenFreeMap is the style, no fallbacks, and the reserve is not reported as dropped (v0.2.3)', () => {
    const s = resolveStack(registry, { ...corea, keys: () => undefined });
    expect(s.styleUrl).toBe('https://tiles.openfreemap.org/styles/dark');
    expect(s.dropped.map((d) => d.id)).not.toContain('carto-dark-matter');
    expect(s.styleFallbacks).toEqual([]);
  });

  test('with a CARTO key: the default stays OpenFreeMap, carto is offered as a fallback with its own credit, customAttribution stays empty', () => {
    const s = resolveStack(registry, { ...corea, keys: keysFrom({ CARTO_API_KEY: 'k-1234567890abcdefghij' }) });
    expect(s.styleUrl).toBe('https://tiles.openfreemap.org/styles/dark');
    expect(s.styleFallbacks).toEqual([{ id: 'carto-dark-matter', styleUrl: CARTO_STYLE, keyRequired: 'CARTO_API_KEY', attribution: '© CARTO © OpenStreetMap contributors' }]);
    expect(s.included).toContain('carto-dark-matter');
    expect(s.customAttribution).toEqual([]);
  });

  test('a style-URL override onto a keyed provider needs that key; a denied host is still refused', () => {
    expect(() => resolveBasemapStyleUrl(registry, CARTO_STYLE)).toThrow(/CARTO_API_KEY/);
    expect(resolveBasemapStyleUrl(registry, CARTO_STYLE, keysFrom({ CARTO_API_KEY: 'k-1234567890abcdefghij' }))).toBe(CARTO_STYLE);
    expect(() => resolveBasemapStyleUrl(registry, 'https://server.arcgisonline.com/x/style.json')).toThrow(/denied/);
    expect(resolveBasemapStyleUrl(registry, 'https://tiles.example.org/self-hosted/style.json')).toBe('https://tiles.example.org/self-hosted/style.json');
  });
});
