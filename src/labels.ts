/**
 * Label policy (owner decision 2026-09-17): Korean first on every locale — 동해, never "Sea of Japan".
 * OpenFreeMap's default text-field draws "latin\nnonlatin", so every consumer must inject this expression.
 */
export const LABEL_PREFERENCE: readonly string[] = ['name:ko', 'name:latin', 'name'];

export type Expression = unknown[];

export interface LayerLike {
  id: string;
  type: string;
  source?: string;
  'source-layer'?: string;
  filter?: unknown;
  minzoom?: number;
  maxzoom?: number;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
}

export interface SymbolLayerSpec extends LayerLike {
  type: 'symbol';
  source: string;
  'source-layer': string;
  layout: Record<string, unknown>;
}

/** MapLibre `coalesce` over the preferred name properties. */
export function labelTextField(preferred: readonly string[] = LABEL_PREFERENCE): Expression {
  return ['coalesce', ...preferred.map((key) => ['get', key])];
}

/** New style with every symbol layer that has a text-field rewritten to the preferred names. Input is not mutated. */
export function localizeLabels<T extends { layers: LayerLike[] }>(style: T, preferred: readonly string[] = LABEL_PREFERENCE): T {
  const textField = labelTextField(preferred);
  return {
    ...style,
    layers: style.layers.map((l) => (l.type === 'symbol' && l.layout && 'text-field' in l.layout ? { ...l, layout: { ...l.layout, 'text-field': textField } } : l)),
  };
}

/**
 * Point water names (seas, bays, lakes) as a layer cloned from the style's own `water_name` layer, which in
 * OpenFreeMap dark draws only LineString names (rivers). The tiles carry the sea points with name:ko
 * (동해 from z5), so the clone keeps the template's fonts and paint and only changes geometry and label.
 */
export function seaNameLayerFrom(template: LayerLike, opts: { id?: string; minzoom?: number; preferred?: readonly string[] } = {}): SymbolLayerSpec {
  if (template.type !== 'symbol' || !template.source || !template['source-layer']) {
    throw new Error(`globe-kit: seaNameLayerFrom needs a symbol layer with source/source-layer (got ${template.id}: ${template.type})`);
  }
  const { filter: _dropped, ...rest } = template;
  return {
    ...rest,
    id: opts.id ?? 'std-water-name-point',
    type: 'symbol',
    source: template.source,
    'source-layer': template['source-layer'],
    filter: ['==', ['geometry-type'], 'Point'],
    minzoom: opts.minzoom ?? 3,
    layout: { ...(template.layout ?? {}), 'text-field': labelTextField(opts.preferred), 'symbol-placement': 'point' },
  };
}
