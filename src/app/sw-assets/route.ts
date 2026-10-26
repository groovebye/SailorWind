import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse, connection } from "next/server";

/**
 * The current build's static files (JS chunks, CSS, fonts) for the service
 * worker to precache (public/sw.js). Pages lazy-load some chunks (the maps),
 * which no page HTML lists — without them a saved plan fails offline with a
 * ChunkLoadError. ~2.5 MB per build.
 */
export async function GET() {
  await connection();
  const root = path.join(process.cwd(), ".next", "static");
  const files: string[] = [];
  async function walk(dir: string) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (!e.name.endsWith(".map")) files.push(`/_next/static/${path.relative(root, p).split(path.sep).join("/")}`);
    }
  }
  try { await walk(root); } catch { /* no build output (dev without a build) */ }
  const build = await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").then((s) => s.trim()).catch(() => "");
  return NextResponse.json({ build, files }, { headers: { "Cache-Control": "no-store" } });
}
