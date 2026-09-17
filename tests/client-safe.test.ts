import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const IMPORT_RE = /^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm;
const NODE_BUILTINS = new Set(['fs', 'path', 'url', 'module', 'os', 'child_process']);

/** Every module specifier reachable from `file`: relative ones are followed, bare ones are recorded. */
function reachableSpecifiers(file: string, seen = new Set<string>(), out = new Set<string>()): Set<string> {
  if (seen.has(file)) return out;
  seen.add(file);
  for (const m of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
    const spec = m[1];
    if (!spec || spec.endsWith('.json')) continue; // bundled data, not code
    if (spec.startsWith('.')) reachableSpecifiers(resolve(dirname(file), spec.endsWith('.ts') ? spec : `${spec}.ts`), seen, out);
    else out.add(spec);
  }
  return out;
}

const isNodeBuiltin = (s: string) => s.startsWith('node:') || NODE_BUILTINS.has(s);

describe('client-safe entry', () => {
  // The kit is consumed by browser bundles (Next client components); one node:fs import anywhere
  // below index.ts makes the whole package server-only — that was the v0.1.x defect (kinx #69).
  test('src/index.ts reaches no node built-in transitively', () => {
    const bare = [...reachableSpecifiers(resolve(SRC, 'index.ts'))];
    expect(bare.filter(isNodeBuiltin)).toEqual([]);
  });

  test('negative control: the walker does see node built-ins where they live (src/node.ts)', () => {
    const bare = [...reachableSpecifiers(resolve(SRC, 'node.ts'))];
    expect(bare.filter(isNodeBuiltin).length).toBeGreaterThan(0);
  });
});
