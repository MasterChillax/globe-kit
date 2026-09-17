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
  keyPlacement?: 'query' | 'path';
  styleUrl?: string;
  layerId?: string;
  tiles?: string[];
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
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
    labelFixtures: { name: string; lng: number; lat: number; zoom: number; expect: string }[];
  };
}
