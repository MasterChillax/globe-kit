/** Registry types — the JSON in registry/providers.json is the single source of truth. */
export type Usage = 'personal' | 'internal' | 'commercial';
export type Exposure = 'private' | 'public';
export type Platform = 'web' | 'native';
export type ProviderKind = 'vector-style' | 'raster' | 'raster-dem';
export type Role = 'basemap' | 'overview' | 'satellite' | 'night' | 'korea-satellite' | 'korea-labels' | 'terrain';

export interface License {
  name: string;
  url: string;
  usage: Usage[];
  exposure: Exposure[];
  verified: string;
  note?: string;
  /** Usages that need a written consent recorded under `consentId` before the provider may ship. */
  consentRequiredFor?: Usage[];
  consentId?: string;
}

export interface Provider {
  id: string;
  kind: ProviderKind;
  role: Role;
  attribution: string;
  license: License;
  platforms: Platform[];
  cacheable: boolean;
  keyRequired: string | null;
  /** 'request': the key rides on every request (app transformRequest), never in the registry URL. */
  keyPlacement?: 'query' | 'path' | 'request';
  /** A vector style kept as a switch-over reserve: never the default styleUrl, listed in styleFallbacks. */
  fallback?: boolean;
  styleUrl?: string;
  layerId?: string;
  tiles?: string[];
  tileSize?: number;
  minzoom?: number;
  /** Source maxzoom: the last zoom the provider serves tiles for. */
  maxzoom?: number;
  /** Layer maxzoom: the zoom from which the layer is hidden (MapLibre semantics). Omit to draw at every zoom. */
  layerMaxzoom?: number;
  /** Vector styles whose own TileJSON already carries the required credit — MapLibre shows it, apps must not repeat it. */
  attributionInStyle?: boolean;
  bounds?: [number, number, number, number];
  opacity?: number;
  visibility?: 'visible' | 'none';
  encoding?: 'terrarium' | 'mapbox';
}

export interface Denied { host: string; reason: string }
export interface Waiver { host: string; app: string; reason: string; issue: string; expires: string }

export interface Registry {
  version: number;
  updated: string;
  record: string;
  providers: Provider[];
  denied: Denied[];
  waivers: Waiver[];
  korea: {
    noElevationReadoutOnNative: boolean;
    publicDemMaxResolutionMetres: number;
    labelFixtures: { name: string; lng: number; lat: number; zoom: number; expect: string; sourceLayer?: string; note?: string }[];
  };
}
