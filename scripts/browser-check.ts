/**
 * browser-check.ts — proves the root entry bundles for the browser (kinx #69 / master-jarvis #734: v0.1.x
 * re-exported node:fs and every client component importing the kit failed under Turbopack).
 * Positive: `src/index.ts` bundles with platform=browser. Negative control: the same entry plus one
 * node:fs import must FAIL, otherwise this check proves nothing. Exit 1 on either violation.
 */
import { build } from 'esbuild';

const common = { bundle: true, platform: 'browser' as const, format: 'esm' as const, write: false, logLevel: 'silent' as const };

async function bundles(entry: { entryPoints?: string[]; stdin?: { contents: string; resolveDir: string; loader: 'ts' } }): Promise<{ ok: boolean; bytes: number; error: string }> {
  try {
    const r = await build({ ...common, ...entry });
    return { ok: true, bytes: (r.outputFiles ?? []).reduce((n, f) => n + f.contents.byteLength, 0), error: '' };
  } catch (e) {
    // esbuild's first line is just "Build failed with N errors:" — the second names the offending import.
    return { ok: false, bytes: 0, error: e instanceof Error ? e.message.split('\n').slice(0, 2).join(' ').trim() : String(e) };
  }
}

const positive = await bundles({ entryPoints: ['src/index.ts'] });
const negative = await bundles({ stdin: { contents: "import 'node:fs';\nexport * from './src/index';\n", resolveDir: process.cwd(), loader: 'ts' } });

let failed = false;
if (!positive.ok) { console.error(`[browser-check] FAIL: src/index.ts does not bundle for the browser — ${positive.error}`); failed = true; }
else console.warn(`[browser-check] ok: src/index.ts bundles for the browser (${positive.bytes} bytes)`);
if (negative.ok) { console.error('[browser-check] FAIL: negative control bundled — an injected node:fs import was not rejected, the check is blind'); failed = true; }
else console.warn(`[browser-check] ok: negative control rejected (${negative.error})`);
process.exit(failed ? 1 : 0);
