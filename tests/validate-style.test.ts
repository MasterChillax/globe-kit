import { describe, it, expect } from 'vitest';
import { loadRegistry } from '../src/index';
import { validateStyleMin, type StyleLike } from '../src/validate-style';

const registry = loadRegistry();

const good: StyleLike = {
  version: 8,
  sources: {
    'gibs-bluemarble': { type: 'raster', tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'], tileSize: 256, maxzoom: 8, attribution: 'NASA GIBS' },
    sat: { type: 'raster', tiles: ['https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token={ARCGIS_API_KEY}'], tileSize: 256, maxzoom: 18, attribution: 'Powered by Esri' },
  },
  layers: [
    { id: 'background', type: 'background' },
    { id: 'std-overview', type: 'raster', source: 'gibs-bluemarble' },
    { id: 'water_name', type: 'symbol' },
  ],
};

describe('validateStyleMin — a clean style passes', () => {
  it('returns no violations for the fixture', () => {
    expect(validateStyleMin(good, registry, { platform: 'web' })).toEqual([]);
  });
});

describe('validateStyleMin — each rule fires on an injected violation (negative controls)', () => {
  it('flags Mapbox-only sky properties (they only raise a MapLibre ErrorEvent at runtime)', () => {
    const bad = { ...good, sky: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0, 0] } } as StyleLike;
    expect(validateStyleMin(bad, registry, { platform: 'web' }).map((v) => v.rule)).toContain('mapbox-sky-prop');
  });

  it('flags a denied host anywhere in a tile URL', () => {
    const bad: StyleLike = { ...good, sources: { ...good.sources, esri: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'x' } } };
    const v = validateStyleMin(bad, registry, { platform: 'web' });
    expect(v.map((x) => x.rule)).toContain('denied-host');
    expect(v.find((x) => x.rule === 'denied-host')!.detail).toMatch(/server\.arcgisonline\.com/);
  });

  it('flags a key literal left in a URL (query token or V-World path key) but not a {PLACEHOLDER}', () => {
    const bad: StyleLike = { ...good, sources: { ...good.sources, leak: { type: 'raster', tiles: ['https://ibasemaps-api.arcgis.com/x/{z}/{y}/{x}?token=AAPK1234567890abcdefghijklmnopqrstuvwxyz'], tileSize: 256, attribution: 'x' } } };
    expect(validateStyleMin(bad, registry, { platform: 'web' }).map((v) => v.rule)).toContain('key-literal');
    expect(validateStyleMin(good, registry, { platform: 'web' }).map((v) => v.rule)).not.toContain('key-literal');
  });

  it('flags raster sources without attribution or without tileSize (when a layer draws them)', () => {
    const bad: StyleLike = {
      ...good,
      sources: { ...good.sources, bare: { type: 'raster', tiles: ['https://example.test/{z}/{x}/{y}.png'] } },
      layers: [...good.layers, { id: 'bare-layer', type: 'raster', source: 'bare' }],
    };
    const rules = validateStyleMin(bad, registry, { platform: 'web' }).map((v) => v.rule);
    expect(rules).toContain('missing-attribution');
    expect(rules).toContain('missing-tilesize');
  });

  it('flags a GIBS source with maxzoom above 8 (overzoom looks like data)', () => {
    const bad: StyleLike = { ...good, sources: { ...good.sources, 'gibs-bluemarble': { ...good.sources['gibs-bluemarble']!, maxzoom: 12 } } };
    expect(validateStyleMin(bad, registry, { platform: 'web' }).map((v) => v.rule)).toContain('gibs-maxzoom');
  });

  it('on native, flags root projection/sky/terrain keys and any contour/elevation layer', () => {
    const bad = { ...good, projection: { type: 'globe' }, terrain: { source: 'dem' }, layers: [...good.layers, { id: 'contour-lines', type: 'line' }] } as StyleLike;
    const rules = validateStyleMin(bad, registry, { platform: 'native' }).map((v) => v.rule);
    expect(rules).toContain('native-root-key');
    expect(rules).toContain('native-elevation-readout');
    expect(validateStyleMin(bad, registry, { platform: 'web' }).map((v) => v.rule)).not.toContain('native-root-key');
  });

  it('a waived host passes for the waived app before expiry and fails for other apps or after expiry', () => {
    const rain: StyleLike = { ...good, sources: { ...good.sources, rain: { type: 'raster', tiles: ['https://tilecache.rainviewer.com/v2/radar/x/256/{z}/{x}/{y}/2/1_1.png'], tileSize: 256, attribution: 'Radar © RainViewer' } } };
    expect(validateStyleMin(rain, registry, { platform: 'web', app: 'kinx', today: '2026-10-01' }).map((v) => v.rule)).not.toContain('unregistered-host');
    expect(validateStyleMin(rain, registry, { platform: 'web', app: 'corea', today: '2026-10-01' }).map((v) => v.rule)).toContain('unregistered-host');
    expect(validateStyleMin(rain, registry, { platform: 'web', app: 'kinx', today: '2026-12-01' }).map((v) => v.rule)).toContain('expired-waiver');
  });
});
