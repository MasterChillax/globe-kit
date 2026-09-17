import type { AppProfile } from './resolve-stack';
import type { Exposure, Registry } from './types';
import { deniedReason, hostOf } from './registry';

/** `host` is `base` or a label-boundary subdomain of it (a.basemaps.cartocdn.com ⊂ basemaps.cartocdn.com). */
function underHost(host: string, base: string): boolean {
  return host === base || host.endsWith(`.${base}`);
}

/**
 * Provider switch: an app may override the vector style URL (e.g. NEXT_PUBLIC_BASEMAP_STYLE_URL) for outages or
 * self-hosting. The URL is normalised (lower-case host, default port dropped) and refused when it is not https,
 * sits on a denied host, is a registered keyed provider — on any of its subdomains — without its key, or, for a
 * public app, is on a host the registry does not know (a public privacy policy names every data recipient).
 * Private apps may self-host on unknown hosts; validateStyleMin still reports `unregistered-host` for them.
 */
export function resolveBasemapStyleUrl(
  registry: Registry,
  override: string | undefined,
  keys?: AppProfile['keys'],
  opts: { exposure?: Exposure } = {},
): string {
  const raw = override?.trim();
  if (raw) {
    let url: URL;
    try { url = new URL(raw); } catch { throw new Error(`globe-kit: basemap style override is not a URL: ${raw}`); }
    if (url.protocol !== 'https:') throw new Error(`globe-kit: basemap style override must be https (got ${url.protocol})`);
    const reason = deniedReason(registry, url.href);
    if (reason) throw new Error(`globe-kit: basemap style override is on a denied host — ${reason}`);
    const host = url.hostname;
    const provider = registry.providers.find((p) => p.kind === 'vector-style' && p.styleUrl && underHost(host, hostOf(p.styleUrl) ?? ''));
    if (provider?.keyRequired && !keys?.(provider.keyRequired)) {
      throw new Error(`globe-kit: basemap style override ${host} is ${provider.id}, which needs ${provider.keyRequired} — no key was provided`);
    }
    if (!provider && opts.exposure === 'public') {
      throw new Error(`globe-kit: basemap style override ${host} is not in the provider registry — a public app may only use hosts its privacy policy names`);
    }
    return url.href;
  }
  const base = registry.providers.find((p) => p.kind === 'vector-style' && p.role === 'basemap' && !p.fallback);
  if (!base?.styleUrl) throw new Error('globe-kit registry: no basemap vector-style provider');
  return base.styleUrl;
}
