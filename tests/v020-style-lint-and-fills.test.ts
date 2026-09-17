import { describe, expect, test } from 'vitest';
import { loadRegistry, validateStyleMin, fillsAboveAnchor, firstSymbolLayerId } from '../src/index';
import type { StyleLike } from '../src/index';

const registry = loadRegistry();
const opts = { platform: 'web' as const, app: 'jarvis', today: '2026-09-17' };

/** The real OpenFreeMap dark style (2026-09-17) carries a raster source no layer references and no attribution on it. */
function ofmLike(referenceShaded: boolean): StyleLike {
  return {
    version: 8,
    sources: {
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      ne2_shaded: { type: 'raster', tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'], maxzoom: 6 },
    },
    layers: [
      { id: 'background', type: 'background' },
      ...(referenceShaded ? [{ id: 'ne2', type: 'raster', source: 'ne2_shaded' }] : []),
      { id: 'water', type: 'fill', source: 'openmaptiles' },
      { id: 'water_name', type: 'symbol', source: 'openmaptiles' },
    ],
  };
}

describe('v0.2.0 — validateStyleMin: attribution/tileSize apply to sources a layer actually draws', () => {
  test('an unreferenced raster source without attribution/tileSize is not a violation (no tile is ever requested)', () => {
    expect(validateStyleMin(ofmLike(false), registry, opts)).toEqual([]);
  });
  test('negative control: the same source referenced by a layer is still red on both rules', () => {
    const rules = validateStyleMin(ofmLike(true), registry, opts).map((v) => v.rule).sort();
    expect(rules).toEqual(['missing-attribution', 'missing-tilesize']);
  });
  test('licence rules still see unreferenced sources: a denied host in the style is red even with no layer', () => {
    const s = ofmLike(false);
    s.sources['old'] = { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'x' };
    expect(validateStyleMin(s, registry, opts).map((v) => v.rule)).toContain('denied-host');
  });
});

describe('v0.2.0 — fillsAboveAnchor: opaque fills that would paint over a raster inserted at the label anchor', () => {
  // OpenFreeMap dark order (2026-09-17): first symbol is water_name, but building/aeroway fills and roads come after it.
  const ofmOrder = [
    { id: 'background', type: 'background' }, { id: 'water', type: 'fill' }, { id: 'landcover_wood', type: 'fill' },
    { id: 'landuse_residential', type: 'fill' }, { id: 'waterway', type: 'line' },
    { id: 'water_name', type: 'symbol' },
    { id: 'building', type: 'fill' }, { id: 'building-3d', type: 'fill-extrusion' }, { id: 'aeroway_fill', type: 'fill' },
    { id: 'highway_motorway', type: 'line' }, { id: 'boundary', type: 'line' }, { id: 'place_city', type: 'symbol' },
  ];
  test('returns fill and fill-extrusion layers positioned after the anchor, in style order', () => {
    const anchor = firstSymbolLayerId(ofmOrder);
    expect(anchor).toBe('water_name');
    expect(fillsAboveAnchor(ofmOrder, anchor)).toEqual(['building', 'building-3d', 'aeroway_fill']);
  });
  test('lines and symbols above the anchor are kept (roads and labels stay readable over imagery)', () => {
    expect(fillsAboveAnchor(ofmOrder, 'water_name')).not.toContain('highway_motorway');
    expect(fillsAboveAnchor(ofmOrder, 'water_name')).not.toContain('place_city');
  });
  test('no anchor (style without symbols) → nothing is above it, nothing to hide', () => {
    expect(fillsAboveAnchor(ofmOrder, null)).toEqual([]);
    expect(fillsAboveAnchor([{ id: 'a', type: 'fill' }], undefined)).toEqual([]);
  });
});
