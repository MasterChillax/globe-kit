/**
 * Self-test: proves the gate can fail. A registry/lint that only ever says "0 violations" is
 * indistinguishable from one that never ran (2026-09 rule: negative control before trusting green).
 * Exit 1 if any injected violation goes undetected or any clean fixture is flagged.
 */
import { loadRegistry, resolveStack, validateStyleMin, type StyleLike, type AppProfile } from '../src/index';

const registry = loadRegistry();
const profile: AppProfile = { app: 'kinx', usage: 'internal', exposure: 'private', platform: 'web', keys: () => undefined, consents: [] };
const failures: string[] = [];
const expect = (cond: boolean, msg: string) => { if (!cond) failures.push(msg); };

// 1. keyless profile must never emit a keyed provider
const stack = resolveStack(registry, profile);
expect(!JSON.stringify(stack).includes('arcgisonline') && !('arcgis-world-imagery' in stack.sources), 'keyless stack leaked ArcGIS imagery');
expect(stack.dropped.some((d) => d.id === 'arcgis-world-imagery' && d.reason === 'missing-key'), 'missing-key drop not recorded');

// 2. clean style from the resolver passes the lint
const clean: StyleLike = { version: 8, sources: stack.sources, layers: [{ id: 'bg', type: 'background' }, ...stack.layers, { id: 'water_name', type: 'symbol' }] };
expect(validateStyleMin(clean, registry, { platform: 'web', app: 'kinx' }).length === 0, 'clean resolver output was flagged');

// 3. every rule must fire on an injected violation
const injected: { rule: string; style: StyleLike; platform: 'web' | 'native' }[] = [
  { rule: 'mapbox-sky-prop', platform: 'web', style: { ...clean, sky: { 'sky-type': 'atmosphere' } } },
  { rule: 'denied-host', platform: 'web', style: { ...clean, sources: { ...clean.sources, x: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'x' } } } },
  { rule: 'key-literal', platform: 'web', style: { ...clean, sources: { ...clean.sources, x: { type: 'raster', tiles: ['https://ibasemaps-api.arcgis.com/t/{z}/{y}/{x}?token=AAPKabcdefghijklmnopqrstuvwxyz0123456789'], tileSize: 256, attribution: 'x' } } } },
  { rule: 'missing-attribution', platform: 'web', style: { ...clean, sources: { ...clean.sources, x: { type: 'raster', tiles: ['https://gibs.earthdata.nasa.gov/x/{z}/{y}/{x}.png'], tileSize: 256 } } } },
  { rule: 'gibs-maxzoom', platform: 'web', style: { ...clean, sources: { ...clean.sources, x: { type: 'raster', tiles: ['https://gibs.earthdata.nasa.gov/x/{z}/{y}/{x}.png'], tileSize: 256, maxzoom: 10, attribution: 'x' } } } },
  { rule: 'native-root-key', platform: 'native', style: { ...clean, projection: { type: 'globe' } } },
  { rule: 'native-elevation-readout', platform: 'native', style: { ...clean, layers: [...clean.layers, { id: 'contour-lines', type: 'line' }] } },
  { rule: 'unregistered-host', platform: 'web', style: { ...clean, sources: { ...clean.sources, x: { type: 'raster', tiles: ['https://tiles.example.test/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'x' } } } },
];
for (const t of injected) {
  const rules = validateStyleMin(t.style, registry, { platform: t.platform, app: 'kinx', today: '2026-10-01' }).map((v) => v.rule);
  expect(rules.includes(t.rule as never), `injected ${t.rule} was NOT detected (rules seen: ${rules.join(',') || 'none'})`);
}

if (failures.length) { console.error('globe-kit selftest FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log(`globe-kit selftest OK — ${injected.length} injected violations detected, clean fixture passes, keyless stack has no ArcGIS`);
