import type { Registry } from './types';
import { deniedReason } from './registry';

/** Provider switch: an app may override the vector style URL (e.g. NEXT_PUBLIC_BASEMAP_STYLE_URL) for outages
 * or self-hosting, but an override on a denied host is refused — a bad env var must not smuggle CARTO back. */
export function resolveBasemapStyleUrl(registry: Registry, override: string | undefined): string {
  const v = override?.trim();
  if (v) {
    const reason = deniedReason(registry, v);
    if (reason) throw new Error(`globe-kit: basemap style override is on a denied host — ${reason}`);
    return v;
  }
  const base = registry.providers.find((p) => p.kind === 'vector-style' && p.role === 'basemap');
  if (!base?.styleUrl) throw new Error('globe-kit registry: no basemap vector-style provider');
  return base.styleUrl;
}
