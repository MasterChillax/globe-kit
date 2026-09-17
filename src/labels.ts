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
  paint: Record<string, unknown>;
}

const NAME: Expression = ['get', 'name'];
const NAME_FIRST_CHAR: Expression = ['slice', ['coalesce', NAME, ''], 0, 1];
/** `name` starts with a Hangul syllable (가–힣). Corea measured Seoul z14: roads 5/391, places 1/203 and
 * water names 2/11 carry a Korean `name` but no name:ko — a plain coalesce showed their romanisation. */
export const HANGUL_NAME: Expression = ['all', ['>=', NAME_FIRST_CHAR, '가'], ['<=', NAME_FIRST_CHAR, '힣']];

/**
 * Label expression for the preferred name properties. With the default preference it is Korean first in
 * the full sense: name:ko, then a Hangul `name`, then name:latin, then name (validated against the
 * MapLibre style-spec in tests). A preference without `name:latin` is a plain coalesce.
 */
export function labelTextField(preferred: readonly string[] = LABEL_PREFERENCE): Expression {
  const latinAt = preferred.indexOf('name:latin');
  if (latinAt < 0) return ['coalesce', ...preferred.map((key) => ['get', key])];
  const branches: unknown[] = [];
  preferred.forEach((key, i) => {
    if (i === latinAt) branches.push(HANGUL_NAME, ['to-string', NAME]);
    if (i < preferred.length - 1) branches.push(['has', key], ['to-string', ['get', key]]);
  });
  return ['case', ...branches, ['to-string', ['get', preferred[preferred.length - 1]]]];
}

/** `name`, `name:xx` or `name_xx` referenced in a text-field expression or `{token}` string. Road shields
 * (`ref`), arrows and fixed strings are not name readers and must keep their own text (Corea, OFM dark). */
const NAME_PROPERTY = /"name(?::[A-Za-z0-9_-]+|_[A-Za-z0-9]+)?"|\{name(?::[A-Za-z0-9_-]+|_[A-Za-z0-9]+)?\}/;
export function readsName(textField: unknown): boolean {
  return textField != null && NAME_PROPERTY.test(JSON.stringify(textField));
}

/** New style with every name-reading symbol layer rewritten to the preferred names. Input is not mutated. */
export function localizeLabels<T extends { layers: LayerLike[] }>(style: T, preferred: readonly string[] = LABEL_PREFERENCE): T {
  const textField = labelTextField(preferred);
  return {
    ...style,
    layers: style.layers.map((l) => (l.type === 'symbol' && l.layout && readsName(l.layout['text-field']) ? { ...l, layout: { ...l.layout, 'text-field': textField } } : l)),
  };
}

/** Sea-name paint for the standard dark basemap: OFM dark's own water_name paint is near-black with no halo,
 * which renders (queryRenderedFeatures says so) at 1.16:1 on the water fill rgb(27,27,29) — invisible.
 * #a8b9ac reads at about 8.4:1 there; the halo keeps it legible over Blue Marble / night imagery. */
export const SEA_NAME_PAINT_DARK: Readonly<Record<string, unknown>> = {
  'text-color': '#a8b9ac',
  'text-halo-color': '#1b1b1d',
  'text-halo-width': 1,
  'text-halo-blur': 0.5,
};

/**
 * Point water names (seas, bays, lakes) as a layer cloned from the style's own `water_name` layer, which in
 * OpenFreeMap dark draws only LineString names (rivers). The tiles carry the sea points with name:ko
 * (동해 from z5), so the clone keeps the template's fonts, changes geometry and label, and takes a readable
 * paint (the template's is made for river lines on dark water).
 */
export function seaNameLayerFrom(
  template: LayerLike,
  opts: { id?: string; minzoom?: number; preferred?: readonly string[]; paint?: Record<string, unknown> } = {},
): SymbolLayerSpec {
  if (template.type !== 'symbol' || !template.source || !template['source-layer']) {
    throw new Error(`globe-kit: seaNameLayerFrom needs a symbol layer with source/source-layer (got ${template.id}: ${template.type})`);
  }
  const { filter: _dropped, paint: _templatePaint, ...rest } = template;
  return {
    ...rest,
    id: opts.id ?? 'std-water-name-point',
    type: 'symbol',
    source: template.source,
    'source-layer': template['source-layer'],
    filter: ['==', ['geometry-type'], 'Point'],
    minzoom: opts.minzoom ?? 3,
    layout: { ...(template.layout ?? {}), 'text-field': labelTextField(opts.preferred), 'symbol-placement': 'point' },
    paint: { ...SEA_NAME_PAINT_DARK, ...(opts.paint ?? {}) },
  };
}
