#!/usr/bin/env node
// Realtime-mode launcher (root `npm run start:realtime`).
// Starts ONLY the Socket.IO realtime server. Port resolution lives in
// apps/realtime/src/index.ts: SERVER_PORT || PORT || REALTIME_PORT || 4001 —
// so on a dedicated Botkeep server it binds the assigned SERVER_PORT, and
// locally REALTIME_PORT keeps working.
// If dist/ is missing (Botkeep syncs sources, then only runs the start
// command), the realtime TypeScript build runs first.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, ensurePrisma, purgeNpmCache } from "./ensure-prisma.mjs";

function main() {
  const realtimeDir = path.join(ROOT, "apps/realtime");
  const entry = path.join(realtimeDir, "dist/index.js");

  purgeNpmCache();
  ensurePrisma(ROOT);

  if (!fs.existsSync(entry)) {
    console.log("[start-realtime] dist/ not found — building realtime first…");
    const build = spawnSync("npm", ["--workspace", "@cinema-online-3d/realtime", "run", "build"], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    if (build.error || build.status !== 0) {
      console.error("[start-realtime] Realtime build failed; cannot start.");
      process.exit(build.status ?? 1);
    }
  }

  if (process.env.CINEMA_BUILD_ONLY === "1") {
    console.log("[start-realtime] Build-only mode — build is ready, exiting without starting the server.");
    return;
  }

  const child = spawn(process.execPath, [entry], {
    cwd: realtimeDir,
    stdio: "inherit",
    env: process.env,
  });

  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));
  child.on("error", (err) => {
    console.error("[start-realtime] Failed to launch realtime server:", err);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) main();
