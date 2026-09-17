import { describe, it, expect } from 'vitest';
import { loadRegistry } from '../src/index';
import { resolveStack, type AppProfile } from '../src/resolve-stack';

const registry = loadRegistry();
const noKeys = () => undefined;
const withKeys = (name: string) => ({ ARCGIS_API_KEY: 'AAPK-test', VWORLD_KEY: 'vw-test' })[name];

const kinx: AppProfile = { app: 'kinx', usage: 'internal', exposure: 'private', platform: 'web', keys: noKeys, consents: [] };
const jarvis: AppProfile = { app: 'jarvis', usage: 'personal', exposure: 'private', platform: 'web', keys: noKeys, consents: [] };
const coreaNative: AppProfile = { app: 'corea', usage: 'commercial', exposure: 'public', platform: 'native', keys: noKeys, consents: [] };

describe('resolveStack — vector-first default', () => {
  it('always yields the OpenFreeMap style URL and the GIBS overview/night rasters without any key', () => {
    const r = resolveStack(registry, kinx);
    expect(r.styleUrl).toBe('https://tiles.openfreemap.org/styles/dark');
    expect(Object.keys(r.sources)).toEqual(expect.arrayContaining(['gibs-bluemarble', 'gibs-black-marble']));
    expect(r.layers.map((l) => l.id)).toEqual(expect.arrayContaining(['std-overview', 'std-night']));
  });

  it('drops keyed satellite with reason missing-key when no key is supplied (negative control for the key gate)', () => {
    const r = resolveStack(registry, kinx);
    expect(Object.keys(r.sources)).not.toContain('arcgis-world-imagery');
    expect(JSON.stringify(r)).not.toMatch(/arcgisonline/);
    expect(r.dropped).toContainEqual({ id: 'arcgis-world-imagery', reason: 'missing-key' });
  });

  it('includes keyed satellite with the key substituted when the key exists', () => {
    const r = resolveStack(registry, { ...kinx, keys: withKeys });
    const sat = r.sources['arcgis-world-imagery'];
    expect(sat).toBeDefined();
    expect(sat!.tiles[0]).toContain('token=AAPK-test');
    expect(sat!.tiles[0]).not.toContain('{ARCGIS_API_KEY}');
    expect(r.layers.map((l) => l.id)).toContain('std-satellite');
  });

  it('orders layers overview → satellite → night so the night raster sits above satellite', () => {
    const ids = resolveStack(registry, { ...kinx, keys: withKeys }).layers.map((l) => l.id);
    expect(ids.indexOf('std-overview')).toBeLessThan(ids.indexOf('std-satellite'));
    expect(ids.indexOf('std-satellite')).toBeLessThan(ids.indexOf('std-night'));
  });
});

describe('resolveStack — V-World consent and platform gates', () => {
  it('internal web app with a V-World key gets both Korea layers (no consent needed for non-commercial)', () => {
    const r = resolveStack(registry, { ...kinx, keys: withKeys });
    expect(Object.keys(r.sources)).toEqual(expect.arrayContaining(['vworld-satellite', 'vworld-hybrid']));
    expect(r.sources['vworld-satellite']!.tiles[0]).toContain('/vw-test/');
  });

  it('commercial app without written consent drops V-World with reason consent-required even with a key', () => {
    const r = resolveStack(registry, { ...coreaNative, platform: 'web', keys: withKeys });
    expect(Object.keys(r.sources)).not.toContain('vworld-satellite');
    expect(r.dropped).toContainEqual({ id: 'vworld-satellite', reason: 'consent-required' });
  });

  it('commercial app with consent vworld-commercial gets V-World', () => {
    const r = resolveStack(registry, { ...coreaNative, platform: 'web', keys: withKeys, consents: ['vworld-commercial'] });
    expect(Object.keys(r.sources)).toContain('vworld-satellite');
  });

  it('native platform never gets terrain (Korea: no elevation readout on phones) and drops it with reason platform', () => {
    const r = resolveStack(registry, { ...coreaNative, keys: withKeys, consents: ['vworld-commercial'] });
    expect(Object.keys(r.sources)).not.toContain('terrarium-dem');
    expect(r.dropped).toContainEqual({ id: 'terrarium-dem', reason: 'platform' });
    expect(r.terrain).toBeNull();
  });

  it('web platform gets terrain as a raster-dem source with terrarium encoding', () => {
    const r = resolveStack(registry, jarvis);
    expect(r.sources['terrarium-dem']).toMatchObject({ type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
    expect(r.terrain).toEqual({ source: 'terrarium-dem', exaggeration: 1 });
  });
});

describe('resolveStack — attribution and denial list', () => {
  it('collects one attribution line per included provider, none for dropped ones', () => {
    const r = resolveStack(registry, kinx);
    expect(r.attribution).toContain('OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors');
    expect(r.attribution.join(' ')).not.toMatch(/Esri/);
  });

  it('never emits a denied host even if a caller passes a fake key for it', () => {
    const r = resolveStack(registry, { ...kinx, keys: withKeys });
    const text = JSON.stringify(r);
    for (const d of registry.denied) expect(text).not.toContain(d.host);
  });
});
