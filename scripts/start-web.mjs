#!/usr/bin/env node
// Web-mode launcher (Botkeep default: root `npm start`).
// Starts ONLY the Next.js web app on 0.0.0.0 at the Botkeep-assigned port:
//   CINEMA_WEB_PORT (set by the combined gateway) || SERVER_PORT || PORT || 3000
// If the production build (.next) is missing — e.g. Botkeep synced sources and
// only runs the start command — the web build runs first.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, ensurePrisma } from "./ensure-prisma.mjs";

export function resolveWebPort(env = process.env) {
  return Number(env.CINEMA_WEB_PORT || env.SERVER_PORT || env.PORT || 3000);
}

function findNextBin(root) {
  const candidates = [
    path.join(root, "node_modules/next/dist/bin/next"),
    path.join(root, "apps/web/node_modules/next/dist/bin/next"),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function main() {
  const port = resolveWebPort();
  const webDir = path.join(ROOT, "apps/web");

  ensurePrisma(ROOT);

  if (!fs.existsSync(path.join(webDir, ".next/BUILD_ID"))) {
    console.log("[start-web] .next build not found — running the web build first (first run can take a while)…");
    const build = spawnSync("npm", ["--workspace", "@cinema-online-3d/web", "run", "build"], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    if (build.error || build.status !== 0) {
      console.error("[start-web] Web build failed; cannot start.");
      process.exit(build.status ?? 1);
    }
  }

  const nextBin = findNextBin(ROOT);
  const args = ["start", "-H", "0.0.0.0", "-p", String(port)];
  const child = nextBin
    ? spawn(process.execPath, [nextBin, ...args], {
        cwd: webDir,
        stdio: "inherit",
        env: { ...process.env, PORT: String(port) },
      })
    : spawn("npm", ["--workspace", "@cinema-online-3d/web", "exec", "--", "next", ...args], {
        cwd: ROOT,
        stdio: "inherit",
        env: { ...process.env, PORT: String(port) },
      });

  console.log(`[start-web] Next.js listening on 0.0.0.0:${port}`);

  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));
  child.on("error", (err) => {
    console.error("[start-web] Failed to launch Next.js:", err);
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
