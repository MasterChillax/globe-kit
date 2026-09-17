/** Label-anchor rule (v2 `std/anchor/under-labels`): raster imagery goes right before the FIRST symbol layer
 * of the vector style so every label — water names, places, roads — stays readable on top of it.
 * Picking any later symbol layer would bury the labels before it (see the negative-control test). */
export interface StyleLayerLike { id: string; type: string }

export function firstSymbolLayerId(layers: readonly StyleLayerLike[]): string | null {
  const hit = layers.find((l) => l.type === 'symbol');
  return hit ? hit.id : null;
}

/**
 * Opaque fills drawn AFTER the anchor — they would paint over imagery inserted there. In OpenFreeMap dark the first
 * symbol is `water_name`, yet `building` (opaque near-black at z12+) and aeroway fills come later; apps hide these while
 * a satellite/night raster is visible. Lines (roads, boundaries) and symbols are kept: they read fine over imagery.
 */
export function fillsAboveAnchor(layers: readonly StyleLayerLike[], anchorId: string | null | undefined): string[] {
  if (!anchorId) return [];
  const at = layers.findIndex((l) => l.id === anchorId);
  if (at < 0) return [];
  return layers.slice(at + 1).filter((l) => l.type === 'fill' || l.type === 'fill-extrusion').map((l) => l.id);
}

/** Returns a new layer list with `inserted` placed just under the labels (or appended when there are none). */
export function insertUnderLabels<T extends StyleLayerLike>(layers: readonly T[], inserted: readonly T[]): T[] {
  const anchor = firstSymbolLayerId(layers);
  if (anchor === null) return [...layers, ...inserted];
  const at = layers.findIndex((l) => l.id === anchor);
  return [...layers.slice(0, at), ...inserted, ...layers.slice(at)];
}
