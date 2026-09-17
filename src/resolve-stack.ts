import type { Exposure, Platform, Provider, Registry, Role, Usage } from './types';
import { deniedReason } from './registry';

export interface AppProfile {
  app: string;
  usage: Usage;
  exposure: Exposure;
  platform: Platform;
  /** Key lookup by registry key name (e.g. ARCGIS_API_KEY). Return undefined when absent — never throw. */
  keys: (name: string) => string | undefined;
  /** Written consents on file, by registry consentId. */
  consents: readonly string[];
}

/**
 * Key lookup from an explicit map. Client bundles need this shape: Next.js inlines only static
 * `process.env.NEXT_PUBLIC_X` references, so `name => process.env['NEXT_PUBLIC_' + name]` is always
 * undefined in the browser. Empty and blank values count as absent.
 */
export function keysFrom(map: Record<string, string | undefined>): AppProfile['keys'] {
  return (name) => {
    const v = map[name];
    return v && v.trim() ? v : undefined;
  };
}

export type DropReason = 'missing-key' | 'consent-required' | 'usage-not-allowed' | 'exposure-not-allowed' | 'platform' | 'denied-host';

export interface RasterSourceSpec {
  type: 'raster' | 'raster-dem';
  tiles: string[];
  tileSize: number;
  attribution: string;
  minzoom?: number;
  maxzoom?: number;
  bounds?: [number, number, number, number];
  encoding?: 'terrarium' | 'mapbox';
}
export interface RasterLayerSpec {
  id: string;
  type: 'raster';
  source: string;
  minzoom?: number;
  maxzoom?: number;
  layout: { visibility: 'visible' | 'none' };
  paint: { 'raster-opacity': number };
}
export interface ResolvedStack {
  styleUrl: string;
  sources: Record<string, RasterSourceSpec>;
  /** Ordered bottom → top; insert them under the labels with anchors.insertUnderLabels. */
  layers: RasterLayerSpec[];
  terrain: { source: string; exaggeration: number } | null;
  attribution: string[];
  included: string[];
  dropped: { id: string; reason: DropReason }[];
}

/** Bottom → top drawing order for the standard raster stack. */
const ROLE_ORDER: Role[] = ['overview', 'satellite', 'korea-satellite', 'night', 'korea-labels'];

function keyed(url: string, p: Provider, key: string | undefined): string {
  return p.keyRequired && key ? url.split(`{${p.keyRequired}}`).join(key) : url;
}

function gate(p: Provider, profile: AppProfile, registry: Registry): DropReason | null {
  if (!p.license.usage.includes(profile.usage)) return 'usage-not-allowed';
  if (!p.license.exposure.includes(profile.exposure)) return 'exposure-not-allowed';
  if (!p.platforms.includes(profile.platform)) return 'platform';
  const needsConsent = (p.license.consentRequiredFor ?? []).includes(profile.usage);
  if (needsConsent && !(p.license.consentId && profile.consents.includes(p.license.consentId))) return 'consent-required';
  if (p.keyRequired && !profile.keys(p.keyRequired)) return 'missing-key';
  for (const url of [...(p.tiles ?? []), ...(p.styleUrl ? [p.styleUrl] : [])]) if (deniedReason(registry, url)) return 'denied-host';
  return null;
}

/** Pure: registry + profile → the exact sources/layers an app may ship. Nothing else decides what is on the map. */
export function resolveStack(registry: Registry, profile: AppProfile): ResolvedStack {
  const out: ResolvedStack = { styleUrl: '', sources: {}, layers: [], terrain: null, attribution: [], included: [], dropped: [] };
  const rasters: { order: number; p: Provider }[] = [];
  for (const p of registry.providers) {
    const reason = gate(p, profile, registry);
    if (reason) { out.dropped.push({ id: p.id, reason }); continue; }
    out.included.push(p.id);
    if (!out.attribution.includes(p.attribution)) out.attribution.push(p.attribution);
    const key = p.keyRequired ? profile.keys(p.keyRequired) : undefined;
    if (p.kind === 'vector-style') { out.styleUrl = p.styleUrl!; continue; }
    const source: RasterSourceSpec = {
      type: p.kind === 'raster-dem' ? 'raster-dem' : 'raster',
      tiles: (p.tiles ?? []).map((t) => keyed(t, p, key)),
      tileSize: p.tileSize ?? 256,
      attribution: p.attribution,
    };
    if (p.minzoom !== undefined) source.minzoom = p.minzoom;
    if (p.maxzoom !== undefined) source.maxzoom = p.maxzoom;
    if (p.bounds) source.bounds = p.bounds;
    if (p.encoding) source.encoding = p.encoding;
    out.sources[p.id] = source;
    if (p.kind === 'raster-dem') { out.terrain = { source: p.id, exaggeration: 1 }; continue; }
    rasters.push({ order: ROLE_ORDER.indexOf(p.role), p });
  }
  rasters.sort((a, b) => a.order - b.order);
  for (const { p } of rasters) {
    const layer: RasterLayerSpec = {
      id: p.layerId ?? `std-${p.role}`,
      type: 'raster',
      source: p.id,
      layout: { visibility: p.visibility ?? 'visible' },
      paint: { 'raster-opacity': p.opacity ?? 1 },
    };
    if (p.minzoom !== undefined) layer.minzoom = p.minzoom;
    // Layer maxzoom hides the layer past it; without it a z8-only source is overzoomed all the way to z18 and covers the vector map.
    if (p.layerMaxzoom !== undefined) layer.maxzoom = p.layerMaxzoom;
    out.layers.push(layer);
  }
  if (!out.styleUrl) throw new Error('globe-kit: no vector-style provider survived the gate — the registry must always ship a keyless basemap');
  return out;
}
