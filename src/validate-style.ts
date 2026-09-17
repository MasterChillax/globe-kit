import type { Platform, Registry } from './types';
import { deniedReason, hostOf } from './registry';

/** The subset of a MapLibre style this lint reads. Extra keys are ignored. */
export interface StyleLike {
  version?: number;
  sources: Record<string, { type: string; tiles?: string[]; url?: string; tileSize?: number; maxzoom?: number; attribution?: string }>;
  layers: { id: string; type: string; source?: string }[];
  sky?: Record<string, unknown>;
  projection?: unknown;
  terrain?: unknown;
}

export type Rule =
  | 'mapbox-sky-prop' | 'denied-host' | 'key-literal' | 'missing-attribution' | 'missing-tilesize'
  | 'gibs-maxzoom' | 'native-root-key' | 'native-elevation-readout' | 'unregistered-host' | 'expired-waiver';

export interface Violation { rule: Rule; where: string; detail: string }
export interface ValidateOptions { platform: Platform; app?: string; today?: string }

const MAPBOX_SKY = /^sky-(type|atmosphere-|gradient|opacity)/;
/** A key literal: token=/key= followed by 20+ url-safe chars, or a 32-hex path segment (V-World). {PLACEHOLDER}s never match. */
const KEY_LITERAL = /(?:[?&](?:token|key|access_token|apikey)=)[A-Za-z0-9_.-]{20,}|\/[0-9A-Fa-f]{32}\//;
const GIBS_HOST = 'gibs.earthdata.nasa.gov';
const ELEVATION_LAYER = /contour|elev|ele[_-]|height|표고|등고/i;

function registeredHosts(registry: Registry): Set<string> {
  const hosts = new Set<string>();
  for (const p of registry.providers) for (const u of [...(p.tiles ?? []), ...(p.styleUrl ? [p.styleUrl] : [])]) { const h = hostOf(u); if (h) hosts.add(h); }
  return hosts;
}

/** Static lint of a style object: fails fast on what MapLibre would only report as a runtime ErrorEvent
 * (Mapbox-only sky props), on licence violations (denied hosts, leaked keys, missing attribution) and on
 * Korea/native policy (no globe/terrain root keys, no elevation readout layers). Pure, no I/O. */
export function validateStyleMin(style: StyleLike, registry: Registry, opts: ValidateOptions): Violation[] {
  const v: Violation[] = [];
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const known = registeredHosts(registry);

  for (const k of Object.keys(style.sky ?? {})) if (MAPBOX_SKY.test(k)) v.push({ rule: 'mapbox-sky-prop', where: 'sky', detail: `${k} is Mapbox-only; MapLibre 5.x globe sky is atmosphere-blend` });

  for (const [id, s] of Object.entries(style.sources)) {
    const urls = [...(s.tiles ?? []), ...(s.url ? [s.url] : [])];
    for (const u of urls) {
      const reason = deniedReason(registry, u);
      if (reason) v.push({ rule: 'denied-host', where: `sources.${id}`, detail: `${hostOf(u)} — ${reason}` });
      if (KEY_LITERAL.test(u)) v.push({ rule: 'key-literal', where: `sources.${id}`, detail: 'a credential literal is embedded in the URL; use a {KEY} placeholder resolved at runtime' });
      const host = hostOf(u);
      if (host && !reason && !known.has(host)) {
        const waiver = registry.waivers.find((w) => (host === w.host || host.endsWith(`.${w.host}`)) && w.app === opts.app);
        if (!waiver) v.push({ rule: 'unregistered-host', where: `sources.${id}`, detail: `${host} is not in the provider registry and has no waiver for app ${opts.app ?? '(unspecified)'}` });
        else if (waiver.expires < today) v.push({ rule: 'expired-waiver', where: `sources.${id}`, detail: `${host} waiver for ${waiver.app} expired ${waiver.expires} (${waiver.issue})` });
      }
      if (host === GIBS_HOST && (s.maxzoom ?? 0) > 8) v.push({ rule: 'gibs-maxzoom', where: `sources.${id}`, detail: `GIBS Level8 layers end at z8; maxzoom ${s.maxzoom} overzooms and reads as data` });
    }
    if (s.type === 'raster' || s.type === 'raster-dem') {
      if (!s.attribution) v.push({ rule: 'missing-attribution', where: `sources.${id}`, detail: 'raster sources must carry their provider attribution' });
      if (!s.tileSize) v.push({ rule: 'missing-tilesize', where: `sources.${id}`, detail: '256px tiles served without tileSize render one zoom blurry' });
    }
  }

  if (opts.platform === 'native') {
    for (const key of ['projection', 'sky', 'terrain'] as const) if (style[key] !== undefined) v.push({ rule: 'native-root-key', where: key, detail: `${key} is not emitted for MapLibre Native (no globe on phones)` });
    if (registry.korea.noElevationReadoutOnNative) for (const l of style.layers) if (ELEVATION_LAYER.test(l.id)) v.push({ rule: 'native-elevation-readout', where: `layers.${l.id}`, detail: '별표1: 좌표와 등고선·표고값을 휴대폰에 함께 표시할 수 없다' });
  }
  return v;
}
