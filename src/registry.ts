import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Registry } from './types';

const REGISTRY_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'registry', 'providers.json');

/** Minimal shape check — a registry that fails this is a bug in this repo, not a runtime condition. */
export function assertRegistry(value: unknown): Registry {
  const r = value as Registry;
  if (!r || typeof r !== 'object' || !Array.isArray(r.providers) || !Array.isArray(r.denied) || !Array.isArray(r.waivers)) {
    throw new Error('globe-kit registry: providers/denied/waivers arrays are required');
  }
  const ids = new Set<string>();
  for (const p of r.providers) {
    if (!p.id || ids.has(p.id)) throw new Error(`globe-kit registry: duplicate or missing provider id ${p.id}`);
    ids.add(p.id);
    if (p.kind !== 'vector-style' && !(p.tiles && p.tiles.length)) throw new Error(`globe-kit registry: ${p.id} needs tiles`);
    if (p.kind === 'vector-style' && !p.styleUrl) throw new Error(`globe-kit registry: ${p.id} needs styleUrl`);
    if (!p.attribution) throw new Error(`globe-kit registry: ${p.id} needs attribution`);
    if (p.kind === 'raster' && !p.tileSize) throw new Error(`globe-kit registry: ${p.id} raster needs tileSize`);
    if (p.keyRequired && !(p.tiles ?? []).some((t) => t.includes(`{${p.keyRequired}}`))) {
      throw new Error(`globe-kit registry: ${p.id} declares keyRequired ${p.keyRequired} but no tile URL carries the {${p.keyRequired}} placeholder`);
    }
  }
  return r;
}

/** Load the bundled registry. Sync on purpose: consumers call it once at module init. */
export function loadRegistry(path: string = REGISTRY_PATH): Registry {
  return assertRegistry(JSON.parse(readFileSync(path, 'utf8')));
}

export function hostOf(url: string): string | null {
  try { return new URL(url.replace(/\{[^}]+\}/g, 'x')).hostname; } catch { return null; }
}

export function deniedReason(registry: Registry, url: string): string | null {
  const host = hostOf(url);
  if (!host) return null;
  const hit = registry.denied.find((d) => host === d.host || host.endsWith(`.${d.host}`));
  return hit ? hit.reason : null;
}
