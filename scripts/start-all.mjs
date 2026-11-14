#!/usr/bin/env node
// Combined-mode gateway (root `npm run start:all`) — OPTIONAL insurance mode.
// Not the Botkeep default (the user prefers one server per component).
//
// Starts web and realtime as child processes on internal ports and listens
// publicly on SERVER_PORT || PORT || 3000:
//   /socket.io/*  (HTTP polling + WebSocket upgrade) -> realtime (internal)
//   everything else                                  -> web (internal)
// The gateway is plain Node.js builtins (http/net) — no extra dependencies.
// Signals are forwarded to both children; if either child dies, the gateway
// shuts the other one down and exits non-zero.
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, purgeNpmCache } from "./ensure-prisma.mjs";

export function isSocketIoPath(rawUrl = "") {
  const pathname = rawUrl.split("?")[0];
  return pathname === "/socket.io" || pathname.startsWith("/socket.io/");
}

export function resolveGatewayPorts(env = process.env) {
  const publicPort = Number(env.SERVER_PORT || env.PORT || 3000);
  let webPort = Number(env.WEB_INTERNAL_PORT || 3100);
  if (webPort === publicPort) webPort = publicPort === 3100 ? 3101 : 3100;
  const envRealtime = Number(env.REALTIME_PORT || 0);
  let realtimePort = Number(
    env.REALTIME_INTERNAL_PORT || (envRealtime && envRealtime !== publicPort ? envRealtime : 4001)
  );
  if (realtimePort === publicPort || realtimePort === webPort) realtimePort = 4001;
  if (realtimePort === publicPort || realtimePort === webPort) realtimePort = 4002;
  return { publicPort, webPort, realtimePort };
}

export function createGateway({ webPort, realtimePort }) {
  const server = http.createServer((req, res) => {
    const targetPort = isSocketIoPath(req.url) ? realtimePort : webPort;
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: targetPort,
        method: req.method,
        path: req.url,
        headers: req.headers,
      },
      (upRes) => {
        res.writeHead(upRes.statusCode || 502, upRes.headers);
        upRes.pipe(res);
      }
    );
    upstream.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      res.end("Bad gateway");
    });
    req.pipe(upstream);
  });

  server.on("upgrade", (req, socket, head) => {
    const targetPort = isSocketIoPath(req.url) ? realtimePort : webPort;
    const upstream = net.connect(targetPort, "127.0.0.1", () => {
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
      for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
        upstream.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
      }
      upstream.write("\r\n");
      if (head && head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });

  return server;
}

export function waitForPort(port, { timeoutMs = 300_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const probe = net.connect(port, "127.0.0.1");
      probe.once("connect", () => {
        probe.end();
        resolve();
      });
      probe.once("error", () => {
        probe.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for 127.0.0.1:${port}`));
        } else {
          setTimeout(attempt, intervalMs);
        }
      });
    };
    attempt();
  });
}

async function main() {
  purgeNpmCache();
  const { publicPort, webPort, realtimePort } = resolveGatewayPorts();

  // Build SEQUENTIALLY before starting anything. On the 512MB Botkeep
  // Free tier, building web while the realtime server is already running
  // (and vice versa) lets the Next.js build worker get SIGKILLed by the
  // memory limit — observed live 2026-11-05. Build-only passes run one
  // at a time; the real children below then find .next/dist ready and
  // skip straight to serving.
  console.log(
    `[start-all] Gateway plan — public :${publicPort} | web internal :${webPort} | realtime internal :${realtimePort}`
  );

  const webEnv = { ...process.env };
  delete webEnv.SERVER_PORT;
  delete webEnv.PORT;
  webEnv.CINEMA_WEB_PORT = String(webPort);

  const realtimeEnv = { ...process.env };
  delete realtimeEnv.SERVER_PORT;
  delete realtimeEnv.PORT;
  realtimeEnv.REALTIME_PORT = String(realtimePort);

  const buildOnly = (name, script, env) => {
    const res = spawnSync(process.execPath, [path.join(ROOT, "scripts", script)], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...env, CINEMA_BUILD_ONLY: "1" },
    });
    if (res.error || res.status !== 0) {
      console.error(`[start-all] ${name} build failed — cannot start.`);
      process.exit(res.status ?? 1);
    }
  };
  buildOnly("web", "start-web.mjs", webEnv);
  buildOnly("realtime", "start-realtime.mjs", realtimeEnv);

  const children = [];
  let shuttingDown = false;
  const shutdown = (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) child.kill("SIGTERM");
    }
    setTimeout(() => process.exit(code), 300);
  };

  const spawnChild = (name, script, env) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", script)], {
      cwd: ROOT,
      stdio: "inherit",
      env,
    });
    child.on("error", (err) => {
      console.error(`[start-all] ${name} failed to launch:`, err);
      shutdown(1);
    });
    child.on("exit", (code, signal) => {
      if (!shuttingDown) {
        console.error(`[start-all] ${name} exited (code=${code}, signal=${signal}) — shutting down.`);
        shutdown(code && code !== 0 ? code : 1);
      }
    });
    children.push(child);
    return child;
  };

  spawnChild("web", "start-web.mjs", webEnv);
  spawnChild("realtime", "start-realtime.mjs", realtimeEnv);

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  try {
    await Promise.all([waitForPort(webPort), waitForPort(realtimePort)]);
  } catch (err) {
    console.error("[start-all]", err.message);
    shutdown(1);
    return;
  }
  if (shuttingDown) return;

  const gateway = createGateway({ webPort, realtimePort });
  gateway.listen(publicPort, "0.0.0.0", () => {
    console.log(`[start-all] Gateway listening on 0.0.0.0:${publicPort} (/socket.io/ -> :${realtimePort}, rest -> :${webPort})`);
  });
  gateway.on("error", (err) => {
    console.error("[start-all] Gateway error:", err);
    shutdown(1);
  });
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[start-all]", err);
    process.exit(1);
  });
}
