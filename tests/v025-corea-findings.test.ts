import { describe, expect, test } from 'vitest';
import { loadRegistry, validateStyleMin, localizeLabels, labelTextField, seaNameLayerFrom, readsName, SEA_NAME_PAINT_DARK } from '../src/index';
import type { StyleLike } from '../src/index';

const registry = loadRegistry();

// Corea C1 (#150) findings against v0.2.2, verified on the real OpenFreeMap dark style.
describe('v0.2.5 — localizeLabels touches only layers that read a name', () => {
  test('readsName: name / name:* / name_* in expressions or {tokens} count, ref and plain strings do not', () => {
    expect(readsName('{name:latin}\n{name:nonlatin}')).toBe(true);
    expect(readsName(['get', 'name'])).toBe(true);
    expect(readsName(['coalesce', ['get', 'name:ko'], ['get', 'name_en']])).toBe(true);
    expect(readsName(['to-string', ['get', 'ref']])).toBe(false);
    expect(readsName('{ref}')).toBe(false);
    expect(readsName('▲')).toBe(false);
    expect(readsName(undefined)).toBe(false);
  });

  test('the motorway shield keeps its ref; the place label is localised', () => {
    const style = {
      layers: [
        { id: 'highway_name_motorway', type: 'symbol', layout: { 'text-field': ['to-string', ['get', 'ref']], 'text-font': ['Noto Sans Regular'] } },
        { id: 'road_oneway', type: 'symbol', layout: { 'icon-image': 'oneway' } },
        { id: 'place_city', type: 'symbol', layout: { 'text-field': '{name:latin}\n{name:nonlatin}' } },
      ],
    };
    const out = localizeLabels(style);
    expect(out.layers[0]).toEqual(style.layers[0]);
    expect(out.layers[1]).toEqual(style.layers[1]);
    expect(out.layers[2]?.layout?.['text-field']).toEqual(labelTextField());
  });
});

describe('v0.2.5 — seaNameLayerFrom is readable on the dark water it sits on', () => {
  const template = {
    id: 'water_name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name',
    filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    layout: { 'text-field': '{name:latin}', 'text-font': ['Noto Sans Italic'], 'symbol-placement': 'line', 'text-size': 12 },
    // OFM dark: near-black text with no halo — 1.16:1 on rgb(27,27,29) water. Rendered, invisible.
    paint: { 'text-color': 'hsla(0,0%,0%,0.7)', 'text-halo-width': 0 },
  };
  test('default paint is the dark-map sea-name palette, not the template paint', () => {
    const layer = seaNameLayerFrom(template);
    expect(layer.paint).toEqual(SEA_NAME_PAINT_DARK);
    expect(SEA_NAME_PAINT_DARK['text-halo-width']).toBeGreaterThan(0);
    expect(layer.layout['text-font']).toEqual(['Noto Sans Italic']); // fonts still come from the style
  });
  test('an explicit paint overrides the default', () => {
    const layer = seaNameLayerFrom(template, { paint: { 'text-color': '#ffffff' } });
    expect(layer.paint).toEqual({ ...SEA_NAME_PAINT_DARK, 'text-color': '#ffffff' });
  });
});

describe('v0.2.5 — registered hosts include their subdomains', () => {
  const opts = { platform: 'web' as const, app: 'corea', today: '2026-09-17' };
  const style = (host: string): StyleLike => ({
    version: 8,
    sources: { carto: { type: 'vector', url: `https://${host}/vector/carto.streets/v1/tiles.json` } },
    layers: [{ id: 'water', type: 'fill', source: 'carto' }],
  });
  test('tiles.basemaps.cartocdn.com (a CARTO style source) is registered via basemaps.cartocdn.com', () => {
    expect(validateStyleMin(style('tiles.basemaps.cartocdn.com'), registry, opts).map((v) => v.rule)).not.toContain('unregistered-host');
  });
  test('negative controls: a look-alike suffix and an unrelated host are still unregistered', () => {
    expect(validateStyleMin(style('basemaps.cartocdn.com.example.net'), registry, opts).map((v) => v.rule)).toContain('unregistered-host');
    expect(validateStyleMin(style('evil-cartocdn.com'), registry, opts).map((v) => v.rule)).toContain('unregistered-host');
  });
});
