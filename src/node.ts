// Node-only entry (`@masterchillax/globe-kit/node`): disk access for scripts and server code.
// Browser bundles use the root entry, whose `loadRegistry()` returns the bundled JSON registry.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Registry } from './types';
import { assertRegistry } from './registry';

const REGISTRY_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'registry', 'providers.json');

/** Load a registry file from disk (defaults to the bundled one) — for tooling that wants a different registry. */
export function loadRegistryFile(path: string = REGISTRY_PATH): Registry {
  return assertRegistry(JSON.parse(readFileSync(path, 'utf8')));
}
