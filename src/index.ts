export type { Usage, Exposure, Platform, Provider, Registry, License, Denied, Waiver } from './types';
// Client-safe: nothing below may reach a node built-in (tests/client-safe.test.ts, scripts/browser-check.ts).
// Disk access lives in './node' (`@masterchillax/globe-kit/node`).
export { loadRegistry, assertRegistry, deniedReason, hostOf } from './registry';
export { resolveStack, keysFrom, rasterDrawnAt } from './resolve-stack';
export type { AppProfile, ResolvedStack, RasterSourceSpec, RasterLayerSpec, DropReason } from './resolve-stack';
export { firstSymbolLayerId, insertUnderLabels, fillsAboveAnchor } from './anchors';
export type { StyleLayerLike } from './anchors';
export { resolveBasemapStyleUrl } from './style-url';
export { validateStyleMin } from './validate-style';
export type { StyleLike, Violation, Rule, ValidateOptions } from './validate-style';
export { buildNotices } from './licenses';
export { LABEL_PREFERENCE, SEA_NAME_PAINT_DARK, labelTextField, localizeLabels, readsName, seaNameLayerFrom } from './labels';
export type { LayerLike, SymbolLayerSpec, Expression } from './labels';
