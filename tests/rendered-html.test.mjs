import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const port = 31_000 + (process.pid % 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
let worker;
let workerOutput = "";

before(async () => {
  worker = spawn(
    "npx",
    [
      "wrangler",
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--port",
      String(port),
      "--ip",
      "127.0.0.1",
      "--inspector-port",
      "0",
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        CI: "1",
        WRANGLER_LOG_PATH: ".wrangler/wrangler-rendered-test.log",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  worker.stdout.on("data", (chunk) => {
    workerOutput += chunk;
  });
  worker.stderr.on("data", (chunk) => {
    workerOutput += chunk;
  });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) {
      throw new Error(`Production worker exited early.\n${workerOutput}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The worker is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Production worker did not become ready.\n${workerOutput}`);
});

after(async () => {
  if (!worker || worker.exitCode !== null) return;
  worker.kill("SIGTERM");
  await new Promise((resolve) => {
    worker.once("exit", resolve);
    setTimeout(resolve, 2_000).unref();
  });
});

function render(pathname = "/") {
  return fetch(`${baseUrl}${pathname}`, {
    headers: { accept: "text/html" },
  });
}

test("server-renders the Nexus Command shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Command \| Nexus OS<\/title>/i);
  assert.match(html, /Command center/);
  assert.match(html, /Loading Command/);
  assert.match(html, /Private local workspace/);
  assert.match(html, /nexus-emblem-96\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("renders an honest unbuilt module destination", async () => {
  const response = await render("/atlas");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Atlas is not connected yet/);
  assert.match(html, /no fake records/i);
});
