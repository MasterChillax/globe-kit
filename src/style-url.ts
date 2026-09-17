import type { AppProfile } from './resolve-stack';
import type { Registry } from './types';
import { deniedReason, hostOf } from './registry';

/**
 * Provider switch: an app may override the vector style URL (e.g. NEXT_PUBLIC_BASEMAP_STYLE_URL) for outages or
 * self-hosting. Refused: a denied host, and a registered keyed provider (CARTO) without its key — a bad env var
 * must not smuggle a keyless basemap back. Unknown hosts (self-hosted PMTiles) pass; validateStyleMin reports them.
 */
export function resolveBasemapStyleUrl(registry: Registry, override: string | undefined, keys?: AppProfile['keys']): string {
  const v = override?.trim();
  if (v) {
    const reason = deniedReason(registry, v);
    if (reason) throw new Error(`globe-kit: basemap style override is on a denied host — ${reason}`);
    const host = hostOf(v);
    const keyed = registry.providers.find((p) => p.kind === 'vector-style' && p.keyRequired && p.styleUrl && hostOf(p.styleUrl) === host);
    if (keyed?.keyRequired && !keys?.(keyed.keyRequired)) {
      throw new Error(`globe-kit: basemap style override ${host} is ${keyed.id}, which needs ${keyed.keyRequired} — no key was provided`);
    }
    return v;
  }
  const base = registry.providers.find((p) => p.kind === 'vector-style' && p.role === 'basemap' && !p.fallback);
  if (!base?.styleUrl) throw new Error('globe-kit registry: no basemap vector-style provider');
  return base.styleUrl;
}
