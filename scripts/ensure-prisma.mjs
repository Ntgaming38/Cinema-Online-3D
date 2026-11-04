#!/usr/bin/env node
// Ensures the Prisma client is generated (node_modules/.prisma/client).
// Used by the root "postinstall" script and by the start launchers.
//
// Failure policy: a failed `prisma generate` (e.g. the sandbox/CI machine
// cannot download Prisma engines) must NOT break `npm install` or process
// startup with an opaque error, so this helper logs a loud warning and
// reports failure through its return value instead of a non-zero exit code.
// Callers that truly need the client (the running apps) will surface their
// own Prisma errors at runtime if generation really is impossible.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function prismaClientGenerated(root = ROOT) {
  const candidates = [
    path.join(root, "node_modules/.prisma/client/index.js"),
    path.join(root, "node_modules/.prisma/client/default.js"),
    path.join(root, "apps/web/node_modules/.prisma/client/index.js"),
    path.join(root, "apps/realtime/node_modules/.prisma/client/index.js"),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

export function runPrismaGenerate(root = ROOT) {
  const cli = path.join(root, "node_modules/prisma/build/index.js");
  let result;
  if (fs.existsSync(cli)) {
    result = spawnSync(process.execPath, [cli, "generate"], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
  } else {
    result = spawnSync("npx", ["prisma", "generate"], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
  }
  return !result.error && result.status === 0;
}

// Botkeep Free servers have a 1,024MB disk quota. A full `npm ci` leaves
// behind two heavy things: node_modules (~750MB, needed) and the npm
// download cache (~250MB, only useful to speed up the NEXT install).
// Together with the .next build output they exceed the quota and the
// daemon kills the process mid-build. The launchers therefore delete the
// download cache right after install, before building: installs get
// slower (tarballs are re-downloaded next boot) but the build fits.
// Opt out with CINEMA_KEEP_NPM_CACHE=1.
export function purgeNpmCache() {
  if (process.env.CINEMA_KEEP_NPM_CACHE === "1") return;
  try {
    const cacheDir =
      process.env.npm_config_cache || path.join(os.homedir(), ".npm");
    const target = path.join(cacheDir, "_cacache");
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[launch] Purged npm download cache at ${target} to free disk for the build.`);
    }
  } catch (err) {
    console.warn(`[launch] Could not purge npm cache (continuing): ${err.message}`);
  }
}

export function ensurePrisma(root = ROOT) {
  if (prismaClientGenerated(root)) return true;
  console.log("[ensure-prisma] Prisma client not generated yet — running `prisma generate`…");
  const ok = runPrismaGenerate(root);
  if (!ok) {
    console.warn(
      "[ensure-prisma] WARNING: `prisma generate` failed (engine download blocked?). " +
        "Continuing anyway; database-backed routes will fail until the client can be generated."
    );
  }
  return ok;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  // postinstall entry point: always exit 0 (see failure policy above).
  ensurePrisma();
}
